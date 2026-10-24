import type { RowDataPacket } from "mysql2";
import { execute, pool, rows } from "../config/database";
import { AppError } from "../utils/errors";
import type { z } from "zod";
import type { categorySchema, imageSchema, productSchema, variantSchema } from "../validators/schemas";

type CategoryInput = z.infer<typeof categorySchema>;
type ProductInput = z.infer<typeof productSchema>;

export async function listCategories(
  admin: boolean,
  page: number,
  limit: number,
): Promise<{ data: RowDataPacket[]; total: number }> {
  const where = admin ? "" : "WHERE status='ACTIVE'";
  const [count] = await rows<CountRow>(`SELECT COUNT(*) AS total FROM categories ${where}`);
  const data = await rows(
    `SELECT id, name, slug, description, image_url, status, sort_order, created_at
     FROM categories ${where} ORDER BY sort_order, name LIMIT ? OFFSET ?`,
    [limit, (page - 1) * limit],
  );
  return { data, total: Number(count?.total ?? 0) };
}

export async function saveCategory(input: CategoryInput, id?: number): Promise<number> {
  if (id) {
    const result = await execute(
      `UPDATE categories SET name=?, slug=?, description=?, image_url=?, status=?, sort_order=? WHERE id=?`,
      [input.name, input.slug, input.description ?? null, input.image_url ?? null, input.status, input.sort_order, id],
    );
    if (!result.affectedRows) {
      const existing = await rows("SELECT id FROM categories WHERE id=?", [id]);
      if (!existing[0]) throw new AppError("Category not found", 404);
    }
    return id;
  }
  const result = await execute(
    `INSERT INTO categories (name, slug, description, image_url, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    [input.name, input.slug, input.description ?? null, input.image_url ?? null, input.status, input.sort_order],
  );
  return result.insertId;
}

export async function listProducts(options: {
  page: number; limit: number; search?: string; category?: string; sort: string; admin: boolean;
}): Promise<{ data: RowDataPacket[]; total: number }> {
  const conditions: string[] = [];
  const values: import("../config/database").SqlValue[] = [];
  if (!options.admin) conditions.push("p.status = 'ACTIVE' AND c.status='ACTIVE'");
  if (options.search) {
    conditions.push("(p.name LIKE ? OR p.slug LIKE ?)");
    values.push(`%${options.search}%`, `%${options.search}%`);
  }
  if (options.category) {
    conditions.push("c.slug = ?");
    values.push(options.category);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortSql: Record<string, string> = {
    newest: "p.created_at DESC",
    name_asc: "p.name ASC",
    price_asc: "MIN(v.price) ASC",
    price_desc: "MIN(v.price) DESC",
  };
  const [count] = await rows<CountRow>(
    `SELECT COUNT(DISTINCT p.id) AS total FROM products p JOIN categories c ON c.id=p.category_id
     LEFT JOIN product_variants v ON v.product_id=p.id AND v.status='ACTIVE' ${where}`,
    values,
  );
  const data = await rows(
    `SELECT p.id, p.name, p.slug, p.short_description, p.status, p.created_at,
       c.id AS category_id, c.name AS category_name,
       MIN(v.price) AS starting_price,
       (SELECT pi.image_url FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.is_primary DESC, pi.sort_order, pi.id LIMIT 1) AS primary_image
     FROM products p JOIN categories c ON c.id=p.category_id
     LEFT JOIN product_variants v ON v.product_id=p.id AND v.status='ACTIVE'
     ${where} GROUP BY p.id, c.id, c.name ORDER BY ${sortSql[options.sort] ?? sortSql.newest}
     LIMIT ? OFFSET ?`,
    [...values, options.limit, (options.page - 1) * options.limit],
  );
  return { data, total: Number(count?.total ?? 0) };
}

interface CountRow extends RowDataPacket { total: number }

export async function productDetail(idOrSlug: string, admin: boolean): Promise<RowDataPacket> {
  const statusFilter = admin ? "" : "AND p.status='ACTIVE' AND c.status='ACTIVE'";
  const products = await rows(
    `SELECT p.id, p.category_id, p.name, p.slug, p.short_description, p.description, p.status,
       c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id=p.category_id
     WHERE (p.id = ? OR p.slug = ?) ${statusFilter}
     ORDER BY (p.id = ?) DESC LIMIT 1`,
    [idOrSlug, idOrSlug, idOrSlug],
  );
  const product = products[0];
  if (!product) throw new AppError("Product not found", 404);
  const productId = product.id as number;
  const [variants, images, rating] = await Promise.all([
    rows(
      `SELECT v.id, v.sku, v.name, v.volume, v.unit, v.price, v.compare_price, v.status,
        ${admin ? "i.quantity, i.reserved_quantity, GREATEST(i.quantity - i.reserved_quantity, 0) AS available_quantity" : "(i.quantity > i.reserved_quantity) AS in_stock"}
       FROM product_variants v LEFT JOIN inventory i ON i.variant_id=v.id
       WHERE v.product_id=? ${admin ? "" : "AND v.status='ACTIVE'"} ORDER BY v.id`,
      [productId],
    ),
    rows(
      "SELECT id, image_url, alt_text, is_primary, sort_order FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order, id",
      [productId],
    ),
    rows(
      `SELECT AVG(rating) AS average_rating, COUNT(*) AS review_count FROM reviews
       WHERE product_id=? AND status='APPROVED'`,
      [productId],
    ),
  ]);
  return { ...product, variants, images, rating: rating[0] ?? { average_rating: null, review_count: 0 } };
}

export async function saveProduct(input: ProductInput, id?: number): Promise<number> {
  if (id) {
    const result = await execute(
      `UPDATE products SET category_id=?, name=?, slug=?, short_description=?, description=?, status=? WHERE id=?`,
      [input.category_id, input.name, input.slug, input.short_description ?? null, input.description ?? null, input.status, id],
    );
    if (!result.affectedRows) {
      const existing = await rows("SELECT id FROM products WHERE id=?", [id]);
      if (!existing[0]) throw new AppError("Product not found", 404);
    }
    return id;
  }
  const result = await execute(
    `INSERT INTO products (category_id, name, slug, short_description, description, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [input.category_id, input.name, input.slug, input.short_description ?? null, input.description ?? null, input.status],
  );
  return result.insertId;
}

export async function relatedProducts(productId: number): Promise<RowDataPacket[]> {
  return rows(
    `SELECT p.id, p.name, p.slug, p.short_description, MIN(v.price) AS starting_price
     FROM products current
     JOIN products p ON p.category_id=current.category_id AND p.id<>current.id AND p.status='ACTIVE'
     LEFT JOIN product_variants v ON v.product_id=p.id AND v.status='ACTIVE'
     JOIN categories c ON c.id=p.category_id AND c.status='ACTIVE'
     WHERE current.id=? AND current.status='ACTIVE' GROUP BY p.id ORDER BY p.created_at DESC LIMIT 8`,
    [productId],
  );
}

export async function saveVariant(productId: number, input: z.infer<typeof variantSchema>, id?: number): Promise<number> {
  if (id) {
    const result = await execute(
      `UPDATE product_variants SET sku=?, name=?, volume=?, unit=?, price=?, compare_price=?, status=?
       WHERE id=? AND product_id=?`,
      [input.sku, input.name, input.volume ?? null, input.unit ?? null, input.price, input.compare_price ?? null,
        input.status, id, productId],
    );
    if (!result.affectedRows) {
      const existing = await rows("SELECT id FROM product_variants WHERE id=? AND product_id=?", [id, productId]);
      if (!existing[0]) throw new AppError("Product variant not found", 404);
    }
    return id;
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO product_variants (product_id, sku, name, volume, unit, price, compare_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, input.sku, input.name, input.volume ?? null, input.unit ?? null, input.price,
        input.compare_price ?? null, input.status],
    );
    const variantId = (result as { insertId: number }).insertId;
    await connection.execute("INSERT INTO inventory (variant_id, quantity) VALUES (?, 0)", [variantId]);
    await connection.commit();
    return variantId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveImage(productId: number, input: z.infer<typeof imageSchema>): Promise<number> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [products] = await connection.execute<RowDataPacket[]>("SELECT id FROM products WHERE id=? FOR UPDATE", [productId]);
    if (!products[0]) throw new AppError("Product not found", 404);
    if (input.is_primary) {
      await connection.execute("UPDATE product_images SET is_primary=FALSE WHERE product_id=?", [productId]);
    }
    const [result] = await connection.execute(
      `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [productId, input.image_url, input.alt_text ?? null, input.is_primary, input.sort_order],
    );
    await connection.commit();
    return (result as { insertId: number }).insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setPrimaryImage(imageId: number): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [images] = await connection.execute<(RowDataPacket & { id: number; product_id: number })[]>(
      "SELECT id, product_id FROM product_images WHERE id=? FOR UPDATE",
      [imageId],
    );
    const image = images[0];
    if (!image) throw new AppError("Product image not found", 404);
    await connection.execute("UPDATE product_images SET is_primary=FALSE WHERE product_id=?", [image.product_id]);
    await connection.execute("UPDATE product_images SET is_primary=TRUE WHERE id=?", [imageId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateProductImage(imageId: number, input: z.infer<typeof imageSchema>): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [images] = await connection.execute<(RowDataPacket & { id: number; product_id: number })[]>(
      "SELECT id, product_id FROM product_images WHERE id=? FOR UPDATE",
      [imageId],
    );
    const image = images[0];
    if (!image) throw new AppError("Product image not found", 404);
    if (input.is_primary) {
      await connection.execute("UPDATE product_images SET is_primary=FALSE WHERE product_id=?", [image.product_id]);
    }
    await connection.execute(
      `UPDATE product_images SET image_url=?, alt_text=?, is_primary=?, sort_order=?,
       updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [input.image_url, input.alt_text ?? null, input.is_primary, input.sort_order, imageId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteProductImage(imageId: number): Promise<void> {
  const result = await execute("DELETE FROM product_images WHERE id=?", [imageId]);
  if (!result.affectedRows) throw new AppError("Product image not found", 404);
}

export async function productIdForVariant(variantId: number): Promise<number> {
  const variants = await rows<VariantProductIdRow>(
    "SELECT product_id FROM product_variants WHERE id=?",
    [variantId],
  );
  if (!variants[0]) throw new AppError("Product variant not found", 404);
  return Number(variants[0].product_id);
}
interface VariantProductIdRow extends RowDataPacket { product_id: number }

export async function deactivateVariant(variantId: number): Promise<void> {
  const result = await execute(
    "UPDATE product_variants SET status='INACTIVE', updated_at=CURRENT_TIMESTAMP WHERE id=?",
    [variantId],
  );
  if (!result.affectedRows) throw new AppError("Product variant not found", 404);
}

export async function updateInventory(variantId: number, quantity: number): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [records] = await connection.execute<(RowDataPacket & { reserved_quantity: number })[]>(
      "SELECT reserved_quantity FROM inventory WHERE variant_id=? FOR UPDATE",
      [variantId],
    );
    const inventory = records[0];
    if (!inventory) {
      const [variants] = await connection.execute<RowDataPacket[]>("SELECT id FROM product_variants WHERE id=?", [variantId]);
      if (!variants[0]) throw new AppError("Product variant not found", 404);
      throw new AppError("Inventory record not found for product variant", 404);
    }
    if (Number(inventory.reserved_quantity) > quantity) {
      throw new AppError("Quantity cannot be lower than currently reserved stock", 409);
    }
    await connection.execute(
      "UPDATE inventory SET quantity=?, updated_at=CURRENT_TIMESTAMP WHERE variant_id=?",
      [quantity, variantId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listProductReviews(
  productId: number,
  page: number,
  limit: number,
): Promise<{ data: RowDataPacket[]; total: number }> {
  const products = await rows(
    `SELECT p.id FROM products p JOIN categories c ON c.id=p.category_id
     WHERE p.id=? AND p.status='ACTIVE' AND c.status='ACTIVE'`,
    [productId],
  );
  if (!products[0]) throw new AppError("Product not found", 404);
  const [count] = await rows<CountRow>(
    "SELECT COUNT(*) AS total FROM reviews WHERE product_id=? AND status='APPROVED'",
    [productId],
  );
  const data = await rows(
    `SELECT id, rating, comment, created_at FROM reviews
     WHERE product_id=? AND status='APPROVED'
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [productId, limit, (page - 1) * limit],
  );
  return { data, total: Number(count?.total ?? 0) };
}

export async function createReview(
  productId: number,
  userId: string,
  rating: number,
  comment: string | null,
): Promise<number> {
  const products = await rows(
    `SELECT p.id FROM products p JOIN categories c ON c.id=p.category_id
     WHERE p.id=? AND p.status='ACTIVE' AND c.status='ACTIVE'`,
    [productId],
  );
  if (!products[0]) throw new AppError("Product not found", 404);
  const result = await execute(
    "INSERT INTO reviews (product_id, user_id, rating, comment, status) VALUES (?, ?, ?, ?, 'PENDING')",
    [productId, userId, rating, comment],
  );
  return result.insertId;
}

export async function updateOwnedReview(
  id: number,
  userId: string,
  rating: number,
  comment: string | null,
): Promise<void> {
  const result = await execute(
    "UPDATE reviews SET rating=?, comment=?, status='PENDING', updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
    [rating, comment, id, userId],
  );
  if (!result.affectedRows) {
    const review = await rows("SELECT id FROM reviews WHERE id=?", [id]);
    throw new AppError(review[0] ? "You cannot modify this review" : "Review not found", review[0] ? 403 : 404);
  }
}

export async function deleteOwnedReview(id: number, userId: string): Promise<void> {
  const result = await execute("DELETE FROM reviews WHERE id=? AND user_id=?", [id, userId]);
  if (!result.affectedRows) {
    const review = await rows("SELECT id FROM reviews WHERE id=?", [id]);
    throw new AppError(review[0] ? "You cannot delete this review" : "Review not found", review[0] ? 403 : 404);
  }
}

export async function listBlogPosts(page: number, limit: number): Promise<{ data: RowDataPacket[]; total: number }> {
  const where = "WHERE status='PUBLISHED' AND published_at<=CURRENT_TIMESTAMP";
  const [count] = await rows<CountRow>(`SELECT COUNT(*) AS total FROM blog_posts ${where}`);
  const data = await rows(
    `SELECT id, category_id, title, slug, excerpt, thumbnail_url, published_at
     FROM blog_posts ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
    [limit, (page - 1) * limit],
  );
  return { data, total: Number(count?.total ?? 0) };
}

export async function blogPostBySlug(slug: string): Promise<RowDataPacket> {
  const posts = await rows(
    `SELECT id, category_id, title, slug, excerpt, content, thumbnail_url, published_at
     FROM blog_posts WHERE slug=? AND status='PUBLISHED' AND published_at<=CURRENT_TIMESTAMP LIMIT 1`,
    [slug],
  );
  if (!posts[0]) throw new AppError("Blog post not found", 404);
  return posts[0];
}

export async function archiveCategory(id: number): Promise<void> {
  const result = await execute("UPDATE categories SET status='ARCHIVED', updated_at=CURRENT_TIMESTAMP WHERE id=?", [id]);
  if (!result.affectedRows) {
    const existing = await rows("SELECT id FROM categories WHERE id=?", [id]);
    if (!existing[0]) throw new AppError("Category not found", 404);
  }
}

export async function archiveProduct(id: number): Promise<void> {
  const result = await execute("UPDATE products SET status='ARCHIVED', updated_at=CURRENT_TIMESTAMP WHERE id=?", [id]);
  if (!result.affectedRows) {
    const existing = await rows("SELECT id FROM products WHERE id=?", [id]);
    if (!existing[0]) throw new AppError("Product not found", 404);
  }
}
