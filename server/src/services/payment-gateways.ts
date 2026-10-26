import type { RowDataPacket } from "mysql2";
import { pool, rows } from "../config/database";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

const VND_TO_USD_RATE = 25400;

export interface SepayWebhookPayload {
  id: number;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  transferType?: string;
  transferAmount: number;
  accumulated?: number;
  code?: string | null;
  transactionContent?: string;
  referenceCode?: string;
  body?: string | null;
}

export function convertVndToUsd(amountVnd: number): string {
  const usd = amountVnd / VND_TO_USD_RATE;
  return Math.max(0.01, Math.round(usd * 100) / 100).toFixed(2);
}

export async function processSepayWebhook(payload: SepayWebhookPayload, authHeader?: string): Promise<{ success: boolean; message: string; order_id?: number }> {
  // If SEPAY_API_KEY is configured in .env, verify it
  if (env.SEPAY_API_KEY) {
    const providedKey = authHeader?.replace(/^Apikey\s+/i, "").trim();
    if (providedKey !== env.SEPAY_API_KEY) {
      throw new AppError("Invalid SePay API authorization", 401);
    }
  }

  const content = (payload.transactionContent || "").toUpperCase();
  const amount = Number(payload.transferAmount);

  if (payload.transferType && payload.transferType.toLowerCase() !== "in") {
    return { success: true, message: "Ignored out-transfer" };
  }

  // Find order by matching order_code in transactionContent
  const orderList = await rows<RowDataPacket>(
    "SELECT id, order_code, total_amount, status FROM orders WHERE status IN ('PENDING', 'CONFIRMED') ORDER BY id DESC LIMIT 100",
  );

  const matchedOrder = orderList.find((ord) => {
    const code = String(ord.order_code).toUpperCase();
    return content.includes(code);
  });

  if (!matchedOrder) {
    console.info(`[SEPAY] No matching pending order found in content: "${content}"`);
    return { success: true, message: "Order not found or already completed" };
  }

  if (amount < Number(matchedOrder.total_amount)) {
    console.warn(`[SEPAY] Transfer amount ${amount} is less than order total ${matchedOrder.total_amount}`);
    return { success: false, message: "Insufficient transfer amount", order_id: matchedOrder.id };
  }

  // Update order status to CONFIRMED and payment to COMPLETED
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const txCode = payload.referenceCode || (payload.id ? `SEPAY_${payload.id}` : null);
    await connection.execute(
      "UPDATE orders SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [matchedOrder.id],
    );
    await connection.execute(
      "UPDATE payments SET payment_status = 'PAID', transaction_code = COALESCE(?, transaction_code), paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
      [txCode, matchedOrder.id],
    );
    await connection.commit();
    console.info(`[SEPAY] Order #${matchedOrder.order_code} successfully verified and paid via SePay transaction #${payload.id}`);
    return { success: true, message: "Order payment confirmed", order_id: matchedOrder.id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getPaypalAccessToken(): Promise<string> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new AppError("PayPal credentials are not configured in environment (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)", 503);
  }

  const baseUrl = env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new AppError(`Failed to authenticate with PayPal: ${errText}`, 502);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function createPaypalOrder(orderId: number): Promise<{ paypal_order_id: string; usd_amount: string; approval_url?: string }> {
  const orderList = await rows<RowDataPacket>("SELECT id, order_code, total_amount, status FROM orders WHERE id = ?", [orderId]);
  const order = orderList[0];
  if (!order) throw new AppError("Order not found", 404);

  const usdAmount = convertVndToUsd(Number(order.total_amount));
  const baseUrl = env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const token = await getPaypalAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `ORDER_${order.id}`,
          description: `Thanh toán đơn hàng #${order.order_code} - Nước mắm Nam Ô Hương Làng Cổ`,
          amount: {
            currency_code: "USD",
            value: usdAmount,
          },
        },
      ],
      application_context: {
        brand_name: "Nước Mắm Nam Ô Hương Làng Cổ",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new AppError(`PayPal order creation failed: ${errText}`, 502);
  }

  const data = (await response.json()) as { id: string; links?: Array<{ rel: string; href: string }> };
  const approvalLink = data.links?.find((l) => l.rel === "approve")?.href;

  return {
    paypal_order_id: data.id,
    usd_amount: usdAmount,
    approval_url: approvalLink,
  };
}

export async function capturePaypalOrder(orderId: number, paypalOrderId: string): Promise<{ success: boolean; status: string }> {
  const orderList = await rows<RowDataPacket>("SELECT id, order_code, total_amount FROM orders WHERE id = ?", [orderId]);
  const order = orderList[0];
  if (!order) throw new AppError("Order not found", 404);

  const baseUrl = env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const token = await getPaypalAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new AppError(`PayPal capture failed: ${errText}`, 502);
  }

  const data = (await response.json()) as { status: string };
  if (data.status === "COMPLETED") {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("UPDATE orders SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [orderId]);
      await connection.execute("UPDATE payments SET payment_status = 'PAID', transaction_code = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?", [paypalOrderId, orderId]);
      await connection.commit();
      return { success: true, status: "COMPLETED" };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  return { success: false, status: data.status };
}
