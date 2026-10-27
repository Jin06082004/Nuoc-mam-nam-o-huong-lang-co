import { z } from "zod";

const idSchema = z.coerce.number().int().positive();
const phoneSchema = z.string().trim().min(7).max(32);
const urlSchema = z.string().trim().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "URL must use http or https");
const moneySchema = z.number().nonnegative().max(9_999_999_999.99);
const imageUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (value.startsWith("/uploads/") && !value.includes("\\") && !value.includes("\0")) {
    try {
      return !decodeURIComponent(value).split("/").includes("..");
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}, "Expected an http(s) URL or a safe /uploads/ path");

export const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: phoneSchema.optional(),
  password: z.string().min(10).max(128),
});
export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});
export const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  otp: z.string().trim().length(6).regex(/^\d{6}$/, "Mã xác thực phải gồm 6 chữ số"),
  new_password: z.string().min(10).max(128),
});
export const categorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(65535).nullable().optional(),
  image_url: imageUrlSchema.nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  sort_order: z.number().int().default(0),
});
export const productSchema = z.object({
  category_id: idSchema,
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  short_description: z.string().max(500).nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
});
export const variantSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  volume: z.number().positive().max(99999.999).nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  price: moneySchema,
  compare_price: moneySchema.nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});
export const imageSchema = z.object({
  image_url: imageUrlSchema,
  alt_text: z.string().max(255).nullable().optional(),
  is_primary: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});
export const imageUpdateSchema = imageSchema;
export const cartItemSchema = z.object({
  variant_id: idSchema,
  quantity: z.number().int().positive().max(1000),
});
export const updateCartItemSchema = z.object({ quantity: z.number().int().positive().max(1000) });
export const checkoutSchema = z.object({
  payment_method: z.enum(["COD", "BANK_TRANSFER"]),
  customer_name: z.string().trim().min(2).max(150),
  customer_phone: phoneSchema,
  customer_email: z.string().trim().email().max(255).optional(),
  shipping_address_line: z.string().trim().min(2).max(255),
  shipping_ward: z.string().max(120).nullable().optional(),
  shipping_district: z.string().max(120).nullable().optional(),
  shipping_province: z.string().trim().min(1).max(120),
  note: z.string().max(1000).nullable().optional(),
  coupon_code: z.string().trim().max(64).optional(),
  items: z.array(z.object({
    variant_id: idSchema,
    quantity: z.number().int().positive().max(1000),
  })).optional(),
});
export const orderLookupSchema = z.object({
  order_code: z.string().trim().min(3).max(64),
  phone: z.string().trim().min(7).max(32),
});
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(10000).nullable().optional(),
});
export const couponValidationSchema = z.object({
  code: z.string().trim().min(1).max(64),
  subtotal: moneySchema,
});
export const idParamsSchema = z.object({ id: idSchema });
export const productParamsSchema = z.object({ productId: idSchema });
export const variantParamsSchema = z.object({ variantId: idSchema });
export const reviewStatusSchema = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "HIDDEN"]) });
export const reviewAdminQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "HIDDEN"]).optional(),
});
export const userAdminSchema = z.object({
  role: z.enum(["CUSTOMER", "ADMIN", "STAFF"]),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]),
});
const nullableText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable(),
);
const nullableUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  urlSchema.nullable(),
);
export const storeSettingsSchema = z.object({
  store_name: z.string().trim().min(1).max(150),
  store_description: nullableText(500),
  logo_url: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    imageUrlSchema.nullable(),
  ),
  store_address: nullableText(500),
  contact_phone: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    phoneSchema.nullable(),
  ),
  contact_email: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().email().max(254).nullable(),
  ),
  shipping_fee: moneySchema.nullable(),
  free_shipping_enabled: z.boolean(),
  free_shipping_minimum: moneySchema.nullable(),
  customer_cancellation_statuses: z.array(z.enum(["PENDING", "CONFIRMED"])).max(2)
    .refine((values) => new Set(values).size === values.length, "Cancellation statuses must be unique"),
  cod_enabled: z.boolean(),
  bank_transfer_enabled: z.boolean(),
  bank_name: nullableText(100),
  bank_account_number: nullableText(50),
  bank_account_holder: nullableText(150),
  bank_branch: nullableText(150),
  facebook_url: nullableUrl,
  tiktok_url: nullableUrl,
  youtube_url: nullableUrl,
}).strict().superRefine((settings, context) => {
  if (settings.free_shipping_enabled && settings.free_shipping_minimum === null) {
    context.addIssue({ code: "custom", path: ["free_shipping_minimum"], message: "A minimum order amount is required when free shipping is enabled" });
  }
  if (settings.bank_transfer_enabled) {
    for (const field of ["bank_name", "bank_account_number", "bank_account_holder"] as const) {
      if (!settings[field]) context.addIssue({ code: "custom", path: [field], message: "Required when bank transfer is enabled" });
    }
  }
});
export const activeStatusSchema = z.object({ is_active: z.boolean() });
export const statusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]),
});
export const inventorySchema = z.object({ quantity: z.number().int().nonnegative() });
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(180).optional(),
  sort: z.enum(["newest", "name_asc", "price_asc", "price_desc"]).default("newest"),
});

export const videoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().nullable().optional(),
  video_url: urlSchema.refine((value) => {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be";
  }, "Video URL must be an official YouTube URL"),
  thumbnail_url: imageUrlSchema.nullable().optional(),
  platform: z.literal("YOUTUBE").default("YOUTUBE"),
  is_active: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});
export const socialLinkSchema = z.object({
  platform: z.enum(["FACEBOOK", "TIKTOK", "YOUTUBE"]),
  name: z.string().trim().min(1).max(100),
  url: urlSchema,
  icon: z.string().max(100).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});
export const bannerSchema = z.object({
  title: z.string().trim().min(1).max(200),
  image_url: imageUrlSchema,
  link_url: urlSchema.nullable().optional(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(false),
  start_at: z.string().datetime().nullable().optional(),
  end_at: z.string().datetime().nullable().optional(),
}).refine((value) => !value.start_at || !value.end_at || value.start_at < value.end_at, {
  path: ["end_at"], message: "end_at must be later than start_at",
});
export const blogCategorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  sort_order: z.number().int().default(0),
});
export const blogPostSchema = z.object({
  category_id: idSchema.nullable().optional(),
  title: z.string().trim().min(1).max(220),
  slug: z.string().trim().min(1).max(240).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().min(1),
  thumbnail_url: imageUrlSchema.nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  published_at: z.string().datetime().nullable().optional(),
});
export const couponSchema = z.object({
  code: z.string().trim().min(1).max(64).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(150),
  discount_type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discount_value: moneySchema,
  minimum_order_amount: moneySchema.default(0),
  max_discount_amount: moneySchema.nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  start_at: z.string().datetime().nullable().optional(),
  end_at: z.string().datetime().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]).default("INACTIVE"),
}).refine((value) => value.discount_type !== "PERCENTAGE" || value.discount_value <= 100, {
  path: ["discount_value"], message: "Percentage discounts cannot exceed 100",
}).refine((value) => !value.start_at || !value.end_at || value.start_at < value.end_at, {
  path: ["end_at"], message: "end_at must be later than start_at",
});
