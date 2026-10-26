import type { RowDataPacket } from "mysql2";
import { Router } from "express";
import { z } from "zod";
import { rows } from "../config/database";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { capturePaypalOrder, createPaypalOrder, processSepayWebhook, type SepayWebhookPayload } from "../services/payment-gateways";
import { AppError } from "../utils/errors";
import { asyncRoute, success } from "../utils/http";

export const paymentsRouter = Router();

// SePay automated bank transfer webhook (Public endpoint called by SePay server)
paymentsRouter.post("/payments/sepay/webhook", asyncRoute(async (request, response) => {
  const authHeader = request.headers.authorization;
  const payload = request.body as SepayWebhookPayload;
  const result = await processSepayWebhook(payload, authHeader);
  success(response, result);
}));

// SePay Sandbox Simulation (Convenience route for developer testing)
paymentsRouter.post("/orders/:id/simulate-sepay", asyncRoute(async (request, response) => {
  const orderId = z.coerce.number().int().positive().parse(request.params.id);
  const orderList = await rows<RowDataPacket>("SELECT id, order_code, total_amount FROM orders WHERE id = ?", [orderId]);
  const order = orderList[0];
  if (!order) throw new AppError("Order not found", 404);

  const payload: SepayWebhookPayload = {
    id: Date.now(),
    gateway: "ACMEBank",
    accountNumber: "3897126450",
    subAccount: "SBPAY9735061428",
    transferType: "in",
    transferAmount: Number(order.total_amount),
    transactionContent: `Chuyen khoan don hang ${order.order_code}`,
    referenceCode: `SIM_${Date.now()}`,
  };

  const authHeader = env.SEPAY_API_KEY ? `Apikey ${env.SEPAY_API_KEY}` : undefined;
  const result = await processSepayWebhook(payload, authHeader);
  success(response, { ...result, simulated: true, payload });
}));

// PayPal Sandbox - Create order for payment
paymentsRouter.post("/orders/:id/paypal/create", requireAuth, asyncRoute(async (request, response) => {
  const orderId = z.coerce.number().int().positive().parse(request.params.id);
  const result = await createPaypalOrder(orderId);
  success(response, result);
}));

// PayPal Sandbox - Capture order payment
paymentsRouter.post("/orders/:id/paypal/capture", requireAuth, asyncRoute(async (request, response) => {
  const orderId = z.coerce.number().int().positive().parse(request.params.id);
  const { paypal_order_id } = z.object({ paypal_order_id: z.string().min(1) }).parse(request.body);
  const result = await capturePaypalOrder(orderId, paypal_order_id);
  success(response, result);
}));
