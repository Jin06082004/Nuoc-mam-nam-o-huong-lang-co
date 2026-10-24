import type { RowDataPacket } from "mysql2";
import type { z } from "zod";
import { execute, rows, type SqlValue } from "../config/database";
import { AppError } from "../utils/errors";
import type {
  bannerSchema, blogCategorySchema, blogPostSchema, couponSchema, socialLinkSchema, videoSchema,
} from "../validators/schemas";

type ContentTable = "videos" | "social_links" | "banners" | "blog_categories" | "blog_posts" | "coupons";
export type ContentInputs = {
  videos: z.infer<typeof videoSchema>;
  social_links: z.infer<typeof socialLinkSchema>;
  banners: z.infer<typeof bannerSchema>;
  blog_categories: z.infer<typeof blogCategorySchema>;
  blog_posts: z.infer<typeof blogPostSchema>;
  coupons: z.infer<typeof couponSchema>;
};

const columns: Record<ContentTable, readonly string[]> = {
  videos: ["title", "description", "video_url", "thumbnail_url", "platform", "is_active", "sort_order"],
  social_links: ["platform", "name", "url", "icon", "is_active", "sort_order"],
  banners: ["title", "image_url", "link_url", "sort_order", "is_active", "start_at", "end_at"],
  blog_categories: ["name", "slug", "description", "status", "sort_order"],
  blog_posts: ["category_id", "title", "slug", "excerpt", "content", "thumbnail_url", "status", "published_at"],
  coupons: ["code", "name", "discount_type", "discount_value", "minimum_order_amount", "max_discount_amount",
    "usage_limit", "start_at", "end_at", "status"],
};

export async function listContent<T extends ContentTable>(
  table: T,
  admin: boolean,
  page: number,
  limit: number,
): Promise<{ data: RowDataPacket[]; total: number }> {
  const publicConditions: Partial<Record<ContentTable, string>> = {
    videos: "WHERE is_active=TRUE",
    social_links: "WHERE is_active=TRUE",
    banners: "WHERE is_active=TRUE AND (start_at IS NULL OR start_at<=CURRENT_TIMESTAMP) AND (end_at IS NULL OR end_at>CURRENT_TIMESTAMP)",
    blog_categories: "WHERE status='ACTIVE'",
    blog_posts: "WHERE status='PUBLISHED' AND published_at<=CURRENT_TIMESTAMP",
  };
  const where = admin ? "" : publicConditions[table];
  if (!admin && !where) throw new AppError("This resource is not public", 403);
  const order = table === "coupons" || table === "blog_posts" ? "created_at DESC, id DESC" : "sort_order, id";
  const [count] = await rows<{ total: number } & RowDataPacket>(`SELECT COUNT(*) AS total FROM ${table} ${where ?? ""}`);
  const data = await rows(
    `SELECT * FROM ${table} ${where ?? ""} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [limit, (page - 1) * limit],
  );
  return { data, total: Number(count?.total ?? 0) };
}

export async function getContent<T extends ContentTable>(table: T, id: number): Promise<RowDataPacket> {
  const result = await rows(`SELECT * FROM ${table} WHERE id=? LIMIT 1`, [id]);
  if (!result[0]) throw new AppError("Record not found", 404);
  return result[0];
}

export async function saveContent<T extends ContentTable>(
  table: T,
  input: ContentInputs[T],
  id?: number,
): Promise<number> {
  const keys = columns[table];
  const record = input as Record<string, SqlValue | undefined>;
  const values = keys.map((key) => record[key] ?? null);
  if (id) {
    const assignments = keys.map((key) => `${key}=?`).join(", ");
    const result = await execute(`UPDATE ${table} SET ${assignments}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [...values, id]);
    if (!result.affectedRows) {
      const existing = await rows(`SELECT id FROM ${table} WHERE id=?`, [id]);
      if (!existing[0]) throw new AppError("Record not found", 404);
    }
    return id;
  }
  const result = await execute(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
    values,
  );
  return result.insertId;
}

export async function deactivateContent(table: ContentTable, id: number): Promise<void> {
  const statusColumn = table === "blog_categories" || table === "blog_posts" || table === "coupons" ? "status" : "is_active";
  const value = table === "blog_categories" || table === "blog_posts" ? "ARCHIVED" : "INACTIVE";
  const sql = statusColumn === "status"
    ? `UPDATE ${table} SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    : `UPDATE ${table} SET is_active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id=?`;
  const result = await execute(sql, statusColumn === "status" ? [value, id] : [id]);
  if (!result.affectedRows) {
    const existing = await rows(`SELECT id FROM ${table} WHERE id=?`, [id]);
    if (!existing[0]) throw new AppError("Record not found", 404);
  }
}

export async function setReviewStatus(reviewId: number, status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN"): Promise<void> {
  const result = await execute("UPDATE reviews SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [status, reviewId]);
  if (!result.affectedRows) {
    const existing = await rows("SELECT id FROM reviews WHERE id=?", [reviewId]);
    if (!existing[0]) throw new AppError("Review not found", 404);
  }
}

export async function listAdminInventory(page: number, limit: number): Promise<{ data: RowDataPacket[]; total: number }> {
  const [count] = await rows<{ total: number } & RowDataPacket>("SELECT COUNT(*) AS total FROM inventory");
  const data = await rows(
    `SELECT i.id, i.variant_id, i.quantity, i.reserved_quantity,
      (i.quantity-i.reserved_quantity) AS available_quantity, v.sku, v.name AS variant_name, p.name AS product_name
     FROM inventory i JOIN product_variants v ON v.id=i.variant_id JOIN products p ON p.id=v.product_id
     ORDER BY p.name LIMIT ? OFFSET ?`,
    [limit, (page - 1) * limit],
  );
  return { data, total: Number(count?.total ?? 0) };
}

export async function listAdminReviews(
  page: number,
  limit: number,
  status?: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN",
): Promise<{ data: RowDataPacket[]; total: number }> {
  const where = status ? "WHERE r.status=?" : "";
  const values = status ? [status] : [];
  const [count] = await rows<{ total: number } & RowDataPacket>(`SELECT COUNT(*) AS total FROM reviews r ${where}`, values);
  const data = await rows(
    `SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.status, r.created_at,
       p.name AS product_name, u.full_name AS customer_name
     FROM reviews r JOIN products p ON p.id=r.product_id LEFT JOIN users u ON u.id=r.user_id
     ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit, (page - 1) * limit],
  );
  return { data, total: Number(count?.total ?? 0) };
}

export async function listAdminUsers(page: number, limit: number): Promise<{ data: RowDataPacket[]; total: number }> {
  const [count] = await rows<{ total: number } & RowDataPacket>("SELECT COUNT(*) AS total FROM users");
  const data = await rows(
    `SELECT id, full_name, email, phone, role, status, created_at
     FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, (page - 1) * limit],
  );
  return { data, total: Number(count?.total ?? 0) };
}

export const LOW_STOCK_THRESHOLD = 5;

interface AdminDashboardSummary extends RowDataPacket {
  total_orders: number | string;
  pending_orders: number | string;
  revenue: number | string;
  total_products: number | string;
  total_customers: number | string;
  low_stock_variants: number | string;
}

export async function getAdminDashboardStats(): Promise<{
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockVariants: number;
  lowStockThreshold: number;
  recentOrders: RowDataPacket[];
  recentReviews: RowDataPacket[];
}> {
  const [summaryRows, recentOrders, recentReviews] = await Promise.all([
    rows<AdminDashboardSummary>(
      `SELECT
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COUNT(*) FROM orders WHERE status='PENDING') AS pending_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status<>'CANCELLED') AS revenue,
        (SELECT COUNT(*) FROM products) AS total_products,
        (SELECT COUNT(*) FROM users WHERE role='CUSTOMER') AS total_customers,
        (SELECT COUNT(*) FROM product_variants v
         JOIN products p ON p.id=v.product_id
         LEFT JOIN inventory i ON i.variant_id=v.id
         WHERE p.status='ACTIVE' AND v.status='ACTIVE'
           AND (COALESCE(i.quantity, 0)-COALESCE(i.reserved_quantity, 0))<=?) AS low_stock_variants`,
      [LOW_STOCK_THRESHOLD],
    ),
    rows(
      `SELECT id, order_code, status, total_amount, customer_name, created_at
       FROM orders ORDER BY created_at DESC, id DESC LIMIT 5`,
    ),
    rows(
      `SELECT r.id, r.product_id, r.rating, r.comment, r.status, r.created_at,
        p.name AS product_name, u.full_name AS customer_name
       FROM reviews r
       JOIN products p ON p.id=r.product_id
       LEFT JOIN users u ON u.id=r.user_id
       ORDER BY r.created_at DESC, r.id DESC LIMIT 5`,
    ),
  ]);
  const summary = summaryRows[0];
  return {
    totalOrders: Number(summary?.total_orders ?? 0),
    pendingOrders: Number(summary?.pending_orders ?? 0),
    revenue: Number(summary?.revenue ?? 0),
    totalProducts: Number(summary?.total_products ?? 0),
    totalCustomers: Number(summary?.total_customers ?? 0),
    lowStockVariants: Number(summary?.low_stock_variants ?? 0),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    recentOrders,
    recentReviews,
  };
}

export async function getAdminUserDetail(id: number): Promise<{
  profile: RowDataPacket;
  orders: RowDataPacket[];
  reviews: RowDataPacket[];
}> {
  const [profile] = await rows(
    `SELECT id, full_name, email, phone, role, status, created_at
     FROM users WHERE id=? LIMIT 1`,
    [id],
  );
  if (!profile) throw new AppError("User not found", 404);

  const [orders, reviews] = await Promise.all([
    rows(
      `SELECT id, order_code, status, subtotal, shipping_fee, discount_amount, total_amount, created_at
       FROM orders WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 10`,
      [id],
    ),
    rows(
      `SELECT r.id, r.product_id, r.rating, r.comment, r.status, r.created_at,
        p.name AS product_name
       FROM reviews r JOIN products p ON p.id=r.product_id
       WHERE r.user_id=? ORDER BY r.created_at DESC, r.id DESC LIMIT 10`,
      [id],
    ),
  ]);
  return { profile, orders, reviews };
}

export async function updateUserRoleAndStatus(
  id: number,
  role: "CUSTOMER" | "ADMIN" | "STAFF",
  status: "ACTIVE" | "INACTIVE" | "LOCKED",
): Promise<void> {
  const result = await execute("UPDATE users SET role=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [role, status, id]);
  if (!result.affectedRows) {
    const existing = await rows("SELECT id FROM users WHERE id=?", [id]);
    if (!existing[0]) throw new AppError("User not found", 404);
  }
}

export async function setContentActive(
  table: "videos" | "social_links",
  id: number,
  active: boolean,
): Promise<void> {
  const result = await execute(
    `UPDATE ${table} SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [active, id],
  );
  if (!result.affectedRows) {
    const existing = await rows(`SELECT id FROM ${table} WHERE id=?`, [id]);
    if (!existing[0]) throw new AppError("Content record not found", 404);
  }
}
