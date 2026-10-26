import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool, rows, type SqlValue } from "../config/database";
import { AppError } from "../utils/errors";
import { calculateDiscount, calculateOrderTotals } from "./money";
import { readStoreSettings } from "./settings";
import { sendOrderConfirmationEmail } from "./mail";

async function connectionRows<T extends RowDataPacket>(
  connection: PoolConnection,
  sql: string,
  values: readonly SqlValue[] = [],
): Promise<T[]> {
  const [result] = await connection.execute<T[]>(sql, [...values]);
  return result;
}

export async function getCart(userId: string): Promise<Record<string, unknown>> {
  const cart = await getOrCreateCart(userId);
  const items = await rows(
    `SELECT ci.id, ci.variant_id, ci.quantity, v.name AS variant_name, v.sku,
       v.price, p.id AS product_id, p.name AS product_name, p.slug,
       GREATEST(i.quantity-i.reserved_quantity, 0) AS available_quantity,
       (v.price * ci.quantity) AS line_total
     FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id
     JOIN products p ON p.id=v.product_id
     LEFT JOIN inventory i ON i.variant_id=v.id
     WHERE ci.cart_id=? ORDER BY ci.id`,
    [cart.id],
  );
  return { id: cart.id, status: cart.status, items };
}

async function getOrCreateCart(userId: string): Promise<CartRow> {
  const [result] = await pool.execute(
    "INSERT INTO carts (user_id, status) VALUES (?, 'ACTIVE') ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
    [userId],
  );
  const insertId = (result as { insertId: number }).insertId;
  const cart = await rows<CartRow>("SELECT id, status FROM carts WHERE id=?", [insertId]);
  if (!cart[0]) throw new AppError("Unable to load active cart", 500);
  return cart[0];
}

interface CartRow extends RowDataPacket {
  id: number;
  status: string;
}

export async function addCartItem(userId: string, variantId: number, quantity: number): Promise<Record<string, unknown>> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const cart = await connectionRows<CartRow>(
      connection,
      "SELECT id, status FROM carts WHERE user_id=? AND status='ACTIVE' FOR UPDATE",
      [userId],
    );
    const cartId = cart[0]?.id ?? (await insertCart(connection, userId));
    const variants = await connectionRows<VariantStockRow>(
      connection,
      `SELECT v.id, v.status AS variant_status, p.status AS product_status, c.status AS category_status,
         i.quantity, i.reserved_quantity
       FROM product_variants v JOIN products p ON p.id=v.product_id
       JOIN categories c ON c.id=p.category_id
       LEFT JOIN inventory i ON i.variant_id=v.id
       WHERE v.id=? FOR UPDATE`,
      [variantId],
    );
    const variant = variants[0];
    if (!variant || variant.variant_status !== "ACTIVE" || variant.product_status !== "ACTIVE" || variant.category_status !== "ACTIVE") {
      throw new AppError("Active product variant not found", 404);
    }
    const available = Number(variant.quantity ?? 0) - Number(variant.reserved_quantity ?? 0);
    const current = await connectionRows<QuantityRow>(
      connection,
      "SELECT quantity FROM cart_items WHERE cart_id=? AND variant_id=? FOR UPDATE",
      [cartId, variantId],
    );
    const totalQuantity = Number(current[0]?.quantity ?? 0) + quantity;
    if (totalQuantity > available) throw new AppError("Insufficient inventory", 409);
    await connection.execute(
      `INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity=VALUES(quantity), updated_at=CURRENT_TIMESTAMP`,
      [cartId, variantId, totalQuantity],
    );
    await connection.commit();
    return { cart_id: cartId, variant_id: variantId, quantity: totalQuantity };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

interface VariantStockRow extends RowDataPacket {
  id: number;
  variant_status: string;
  product_status: string;
  quantity: number | null;
  reserved_quantity: number | null;
}
interface QuantityRow extends RowDataPacket { quantity: number }

async function insertCart(connection: PoolConnection, userId: string): Promise<number> {
  const [result] = await connection.execute(
    "INSERT INTO carts (user_id, status) VALUES (?, 'ACTIVE') ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
    [userId],
  );
  return (result as { insertId: number }).insertId;
}

export async function setCartItemQuantity(userId: string, itemId: number, quantity: number): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [items] = await connection.execute<(RowDataPacket & { variant_id: number })[]>(
      `SELECT ci.variant_id FROM cart_items ci JOIN carts c ON c.id=ci.cart_id
       WHERE ci.id=? AND c.user_id=? AND c.status='ACTIVE' FOR UPDATE`,
      [itemId, userId],
    );
    const item = items[0];
    if (!item) throw new AppError("Cart item not found", 404);
    const [stockRows] = await connection.execute<(RowDataPacket & { quantity: number; reserved_quantity: number })[]>(
      "SELECT quantity, reserved_quantity FROM inventory WHERE variant_id=? FOR UPDATE",
      [item.variant_id],
    );
    const stock = stockRows[0];
    if (!stock || Number(stock.quantity) - Number(stock.reserved_quantity) < quantity) {
      throw new AppError("Insufficient inventory", 409);
    }
    await connection.execute("UPDATE cart_items SET quantity=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [quantity, itemId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function removeCartItem(userId: string, itemId: number): Promise<void> {
  const [result] = await pool.execute(
    `DELETE ci FROM cart_items ci JOIN carts c ON c.id=ci.cart_id
     WHERE ci.id=? AND c.user_id=? AND c.status='ACTIVE'`,
    [itemId, userId],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) throw new AppError("Cart item not found", 404);
}

export async function clearCart(userId: string): Promise<void> {
  await pool.execute(
    `DELETE ci FROM cart_items ci JOIN carts c ON c.id=ci.cart_id
     WHERE c.user_id=? AND c.status='ACTIVE'`,
    [userId],
  );
}

export interface CheckoutInput {
  payment_method: "COD" | "BANK_TRANSFER";
  customer_name: string;
  customer_phone: string;
  shipping_address_line: string;
  shipping_ward?: string | null;
  shipping_district?: string | null;
  shipping_province: string;
  note?: string | null;
  coupon_code?: string;
}

export async function createOrder(userId: string, input: CheckoutInput): Promise<Record<string, unknown>> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const settings = await readStoreSettings(connection);
    if (input.payment_method === "COD" && !settings.cod_enabled) {
      throw new AppError("Cash on delivery is currently unavailable", 409);
    }
    if (input.payment_method === "BANK_TRANSFER" && !settings.bank_transfer_enabled) {
      throw new AppError("Bank transfer is currently unavailable", 409);
    }
    if (settings.shipping_fee === null) {
      throw new AppError("Shipping fee has not been configured", 503);
    }
    const carts = await connectionRows<CartRow>(
      connection,
      "SELECT id FROM carts WHERE user_id=? AND status='ACTIVE' FOR UPDATE",
      [userId],
    );
    const cart = carts[0];
    if (!cart) throw new AppError("Cart is empty", 422);

    const items = await connectionRows<CheckoutItemRow>(
      connection,
      `SELECT ci.variant_id, ci.quantity, v.sku, v.name AS variant_name, v.price,
        v.status AS variant_status, p.id AS product_id, p.name AS product_name, p.status AS product_status,
        c.status AS category_status,
        i.quantity AS stock_quantity, i.reserved_quantity
       FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id
       JOIN products p ON p.id=v.product_id JOIN categories c ON c.id=p.category_id
       LEFT JOIN inventory i ON i.variant_id=v.id
       WHERE ci.cart_id=? ORDER BY ci.variant_id FOR UPDATE`,
      [cart.id],
    );
    if (!items.length) throw new AppError("Cart is empty", 422);

    for (const item of items) {
      if (item.product_status !== "ACTIVE" || item.variant_status !== "ACTIVE" || item.category_status !== "ACTIVE") {
        throw new AppError("Cart contains an inactive product variant", 409);
      }
      if (item.stock_quantity === null || Number(item.stock_quantity) - Number(item.reserved_quantity ?? 0) < item.quantity) {
        throw new AppError(`Insufficient inventory for ${item.product_name}`, 409);
      }
    }

    const subtotalItems = items.map((item) => Number(item.price) * item.quantity);
    const subtotal = subtotalItems.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
    let coupon: CouponRow | undefined;
    let discount = 0;
    if (input.coupon_code) {
      const coupons = await connectionRows<CouponRow>(
        connection,
        "SELECT * FROM coupons WHERE code=? AND status='ACTIVE' FOR UPDATE",
        [input.coupon_code.toUpperCase()],
      );
      coupon = coupons[0];
      if (!coupon) throw new AppError("Coupon is invalid or inactive", 422);
      const now = Date.now();
      if (coupon.start_at && new Date(coupon.start_at).getTime() > now) throw new AppError("Coupon is not yet active", 422);
      if (coupon.end_at && new Date(coupon.end_at).getTime() <= now) throw new AppError("Coupon has expired", 422);
      if (Number(coupon.used_count) >= Number(coupon.usage_limit ?? Number.MAX_SAFE_INTEGER)) {
        throw new AppError("Coupon usage limit has been reached", 422);
      }
      if (subtotal < Number(coupon.minimum_order_amount)) throw new AppError("Order does not meet the coupon minimum", 422);
      const priorUse = await connectionRows<CountUsageRow>(
        connection,
        "SELECT COUNT(*) AS count FROM coupon_usages WHERE coupon_id=? AND user_id=?",
        [coupon.id, userId],
      );
      if (Number(priorUse[0]?.count ?? 0) > 0) throw new AppError("Coupon has already been used by this customer", 422);
      discount = calculateDiscount(subtotal, coupon.discount_type, Number(coupon.discount_value),
        coupon.max_discount_amount === null ? null : Number(coupon.max_discount_amount));
    }
    const shippingFee = settings.free_shipping_enabled
      && settings.free_shipping_minimum !== null
      && subtotal >= settings.free_shipping_minimum
      ? 0
      : settings.shipping_fee;
    const totals = calculateOrderTotals(subtotalItems, shippingFee, discount);
    const orderCode = createOrderCode();
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (
        user_id, coupon_id, order_code, status, subtotal, shipping_fee, discount_amount, total_amount, coupon_code,
        customer_name, customer_phone, shipping_address_line, shipping_ward, shipping_district, shipping_province, note
      ) VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, coupon?.id ?? null, orderCode, totals.subtotal, totals.shippingFee, totals.discount, totals.total,
        coupon?.code ?? null, input.customer_name, input.customer_phone, input.shipping_address_line,
        input.shipping_ward ?? null, input.shipping_district ?? null, input.shipping_province, input.note ?? null],
    );
    const orderId = (orderResult as { insertId: number }).insertId;

    for (const item of items) {
      const lineTotal = Math.round(Number(item.price) * item.quantity * 100) / 100;
      await connection.execute(
        `INSERT INTO order_items
          (order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.variant_id, item.product_name, item.variant_name, item.sku,
          item.price, item.quantity, lineTotal],
      );
      const [stockUpdate] = await connection.execute(
        `UPDATE inventory SET quantity=quantity-?, updated_at=CURRENT_TIMESTAMP
         WHERE variant_id=? AND quantity-reserved_quantity>=?`,
        [item.quantity, item.variant_id, item.quantity],
      );
      if ((stockUpdate as { affectedRows: number }).affectedRows !== 1) {
        throw new AppError("Inventory changed while placing the order; please retry", 409);
      }
    }

    await connection.execute(
      `INSERT INTO payments (order_id, payment_method, payment_status, amount)
       VALUES (?, ?, 'PENDING', ?)`,
      [orderId, input.payment_method, totals.total],
    );
    if (coupon) {
      await connection.execute(
        "INSERT INTO coupon_usages (coupon_id, user_id, order_id) VALUES (?, ?, ?)",
        [coupon.id, userId, orderId],
      );
      await connection.execute("UPDATE coupons SET used_count=used_count+1 WHERE id=?", [coupon.id]);
    }
    await connection.execute("DELETE FROM cart_items WHERE cart_id=?", [cart.id]);
    await connection.execute("UPDATE carts SET status='CONVERTED', updated_at=CURRENT_TIMESTAMP WHERE id=?", [cart.id]);
    await connection.commit();

    void (async () => {
      try {
        const userRows = await rows<RowDataPacket>("SELECT email FROM users WHERE id=?", [userId]);
        const customerEmail = (userRows[0] as { email?: string } | undefined)?.email;
        if (customerEmail) {
          const shippingAddress = [
            input.shipping_address_line,
            input.shipping_ward,
            input.shipping_district,
            input.shipping_province,
          ].filter(Boolean).join(", ");

          await sendOrderConfirmationEmail({
            orderCode,
            orderId,
            customerName: input.customer_name,
            customerEmail,
            customerPhone: input.customer_phone,
            shippingAddress,
            paymentMethod: input.payment_method,
            items: items.map((i) => ({
              productName: i.product_name,
              variantName: i.variant_name,
              quantity: i.quantity,
              price: i.price,
              lineTotal: Math.round(Number(i.price) * i.quantity * 100) / 100,
            })),
            subtotal: totals.subtotal,
            shippingFee: totals.shippingFee,
            discountAmount: totals.discount,
            totalAmount: totals.total,
            note: input.note,
            createdAt: new Date().toLocaleString("vi-VN"),
          });
        }
      } catch (err) {
        console.error("Failed to trigger order confirmation email:", err);
      }
    })();

    return { id: orderId, order_code: orderCode, status: "PENDING", ...totals };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

interface CheckoutItemRow extends RowDataPacket {
  variant_id: number;
  quantity: number;
  sku: string;
  variant_name: string;
  price: string | number;
  variant_status: string;
  product_id: number;
  product_name: string;
  product_status: string;
  category_status: string;
  stock_quantity: number | null;
  reserved_quantity: number | null;
}
interface CouponRow extends RowDataPacket {
  id: number;
  code: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value: string | number;
  minimum_order_amount: string | number;
  max_discount_amount: string | number | null;
  usage_limit: number | null;
  used_count: number;
  start_at: Date | string | null;
  end_at: Date | string | null;
}
interface CountUsageRow extends RowDataPacket { count: number }

function createOrderCode(): string {
  return `NO${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export async function listOrders(userId: string, admin: boolean, page: number, limit: number): Promise<{ data: RowDataPacket[]; total: number }> {
  const where = admin ? "" : "WHERE user_id=?";
  const values = admin ? [] : [userId];
  const [count] = await rows<CountUsageRow>(`SELECT COUNT(*) AS count FROM orders ${where}`, values);
  const data = await rows(
    `SELECT id, order_code, status, subtotal, shipping_fee, discount_amount, total_amount,
      customer_name, customer_phone, created_at FROM orders ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit, (page - 1) * limit],
  );
  return { data, total: Number(count?.count ?? 0) };
}

export async function getOrder(userId: string, admin: boolean, orderId: number): Promise<Record<string, unknown>> {
  const orders = await rows<OrderRow>(
    `SELECT * FROM orders WHERE id=? ${admin ? "" : "AND user_id=?"} LIMIT 1`,
    admin ? [orderId] : [orderId, userId],
  );
  const order = orders[0];
  if (!order) throw new AppError("Order not found", 404);
  const [items, payments] = await Promise.all([
    rows("SELECT product_name, variant_name, sku, unit_price, quantity, subtotal FROM order_items WHERE order_id=?", [orderId]),
    rows("SELECT payment_method, payment_status, amount, paid_at FROM payments WHERE order_id=?", [orderId]),
  ]);
  const canCancel = !admin && (await readStoreSettings()).customer_cancellation_statuses.includes(order.status as "PENDING" | "CONFIRMED");
  return { ...order, items, payments, ...(admin ? {} : { can_cancel: canCancel }) };
}

export async function getOrderPayments(userId: string, orderId: number): Promise<RowDataPacket[]> {
  await getOrder(userId, false, orderId);
  return rows(
    "SELECT payment_method, payment_status, amount, transaction_code, paid_at FROM payments WHERE order_id=?",
    [orderId],
  );
}
interface OrderRow extends RowDataPacket { id: number; status: string; user_id: number }

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export async function changeOrderStatus(
  orderId: number,
  nextStatus: string,
  userId: string | null,
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute<OrderRow[]>(
      `SELECT id, status, user_id FROM orders WHERE id=? ${userId ? "AND user_id=?" : ""} FOR UPDATE`,
      userId ? [orderId, userId] : [orderId],
    );
    const order = orders[0];
    if (!order) throw new AppError("Order not found", 404);
    if (!allowedTransitions[order.status]?.includes(nextStatus)) {
      throw new AppError(`Order cannot transition from ${order.status} to ${nextStatus}`, 409);
    }
    if (userId && nextStatus === "CANCELLED") {
      const settings = await readStoreSettings(connection);
      if (!settings.customer_cancellation_statuses.includes(order.status as "PENDING" | "CONFIRMED")) {
        throw new AppError("Customer cancellation is not allowed for this order status", 409);
      }
    }
    if (nextStatus === "CANCELLED") {
      const [items] = await connection.execute<(RowDataPacket & { variant_id: number; quantity: number })[]>(
        "SELECT variant_id, quantity FROM order_items WHERE order_id=? AND variant_id IS NOT NULL FOR UPDATE",
        [orderId],
      );
      for (const item of items) {
        const [restock] = await connection.execute(
          "UPDATE inventory SET quantity=quantity+?, updated_at=CURRENT_TIMESTAMP WHERE variant_id=?",
          [item.quantity, item.variant_id],
        );
        if ((restock as { affectedRows: number }).affectedRows !== 1) {
          throw new AppError("Inventory record is missing while cancelling the order", 409);
        }
      }
      await connection.execute(
        "UPDATE payments SET payment_status='CANCELLED', updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND payment_status='PENDING'",
        [orderId],
      );
      const [couponUsageDelete] = await connection.execute("DELETE FROM coupon_usages WHERE order_id=?", [orderId]);
      if ((couponUsageDelete as { affectedRows: number }).affectedRows) {
        await connection.execute(
          "UPDATE coupons c JOIN orders o ON o.coupon_id=c.id SET c.used_count=GREATEST(c.used_count-1, 0) WHERE o.id=?",
          [orderId],
        );
      }
    }
    await connection.execute("UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [nextStatus, orderId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function couponPreview(code: string, subtotal: number): Promise<Record<string, unknown>> {
  const coupons = await rows<CouponRow>(
    "SELECT * FROM coupons WHERE code=? AND status='ACTIVE' LIMIT 1",
    [code.toUpperCase()],
  );
  const coupon = coupons[0];
  if (!coupon) throw new AppError("Coupon is invalid or inactive", 422);
  const now = Date.now();
  if ((coupon.start_at && new Date(coupon.start_at).getTime() > now) ||
      (coupon.end_at && new Date(coupon.end_at).getTime() <= now) ||
      Number(coupon.used_count) >= Number(coupon.usage_limit ?? Number.MAX_SAFE_INTEGER) ||
      subtotal < Number(coupon.minimum_order_amount)) {
    throw new AppError("Coupon is not available for this order", 422);
  }
  const discount = calculateDiscount(subtotal, coupon.discount_type, Number(coupon.discount_value),
    coupon.max_discount_amount === null ? null : Number(coupon.max_discount_amount));
  return { code: coupon.code, discount_amount: discount };
}
