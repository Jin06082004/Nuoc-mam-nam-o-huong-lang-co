import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(3306),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FRONTEND_URL: z.string().url(),
  SHIPPING_FEE: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.coerce.number().nonnegative().max(9_999_999_999.99).optional(),
  ),
  // Google Mail / SMTP Configuration
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.preprocess((val) => val === "true" || val === true || val === "1", z.boolean()).default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("Nước Mắm Nam Ô - Hương Làng Cổ <huonglangco.namo@gmail.com>"),
  // SePay Sandbox / Production Configuration
  SEPAY_API_KEY: z.string().optional(),
  SEPAY_MERCHANT_ID: z.string().optional(),
  // PayPal Sandbox Configuration
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
}

export const env = parsed.data;
