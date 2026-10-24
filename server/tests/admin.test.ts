import assert from "node:assert/strict";
import test from "node:test";
import type { RowDataPacket } from "mysql2";
import type { SqlValue } from "../src/config/database";

process.env.DATABASE_HOST = "127.0.0.1";
process.env.DATABASE_PORT = "3306";
process.env.DATABASE_NAME = "nam_o_fish_sauce";
process.env.DATABASE_USER = "test";
process.env.DATABASE_PASSWORD = "test";
process.env.JWT_SECRET = "test-only-secret-that-is-not-used-for-a-session";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";
process.env.SHIPPING_FEE = "0";

const { pool } = require("../src/config/database") as typeof import("../src/config/database");
const { getAdminDashboardStats, getAdminUserDetail, LOW_STOCK_THRESHOLD } =
  require("../src/services/admin") as typeof import("../src/services/admin");
const { productDetail } = require("../src/services/catalog") as typeof import("../src/services/catalog");
const { AppError } = require("../src/utils/errors") as typeof import("../src/utils/errors");

type StubResult = RowDataPacket[];
type DatabaseStub = (sql: string, values: readonly SqlValue[]) => StubResult;

async function withDatabaseStub<T>(stub: DatabaseStub, action: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(pool, "execute");
  Object.defineProperty(pool, "execute", {
    configurable: true,
    value: async (sql: string, values: readonly SqlValue[] = []) => [stub(sql, values), []],
  });
  try {
    return await action();
  } finally {
    if (descriptor) Object.defineProperty(pool, "execute", descriptor);
    else delete (pool as unknown as { execute?: unknown }).execute;
  }
}

test("admin dashboard stats use database aggregates and explicit safe recent-record projections", async () => {
  const statements: Array<{ sql: string; values: readonly SqlValue[] }> = [];
  const stats = await withDatabaseStub((sql, values) => {
    statements.push({ sql, values });
    if (sql.includes("AS total_orders")) {
      return [{
        total_orders: "8",
        pending_orders: "2",
        revenue: "1234.50",
        total_products: "14",
        total_customers: "6",
        low_stock_variants: "3",
      } as unknown as RowDataPacket];
    }
    if (sql.includes("FROM orders ORDER BY")) {
      return [{ id: 8, order_code: "DB-ORDER", total_amount: "99.00" } as unknown as RowDataPacket];
    }
    if (sql.includes("FROM reviews r")) {
      return [{ id: 4, rating: 5, product_name: "DB product" } as unknown as RowDataPacket];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }, getAdminDashboardStats);

  assert.equal(stats.totalOrders, 8);
  assert.equal(stats.pendingOrders, 2);
  assert.equal(stats.revenue, 1234.5);
  assert.equal(stats.totalProducts, 14);
  assert.equal(stats.totalCustomers, 6);
  assert.equal(stats.lowStockVariants, 3);
  assert.equal(stats.lowStockThreshold, LOW_STOCK_THRESHOLD);
  assert.equal(stats.recentOrders[0]?.order_code, "DB-ORDER");
  assert.equal(stats.recentReviews[0]?.product_name, "DB product");

  const aggregate = statements.find(({ sql }) => sql.includes("AS total_orders"));
  assert.ok(aggregate);
  assert.match(aggregate.sql, /status<>'CANCELLED'/);
  assert.match(aggregate.sql, /COALESCE\(i\.quantity, 0\)-COALESCE\(i\.reserved_quantity, 0\)/);
  assert.deepEqual(aggregate.values, [LOW_STOCK_THRESHOLD]);
  assert.equal(statements.length, 3);
  for (const { sql } of statements) {
    assert.doesNotMatch(sql, /SELECT\s+\*/i);
    assert.doesNotMatch(sql, /password_hash|access_token|token_hash/i);
  }
});

test("admin user detail returns only safe profile, order, and review fields", async () => {
  const statements: string[] = [];
  const result = await withDatabaseStub((sql) => {
    statements.push(sql);
    if (sql.includes("FROM users WHERE id=?")) {
      return [{
        id: 12,
        full_name: "DB customer",
        email: "db@example.test",
        role: "CUSTOMER",
      } as unknown as RowDataPacket];
    }
    if (sql.includes("FROM orders WHERE user_id=?")) {
      return [{ id: 7, order_code: "DB-ORDER" } as unknown as RowDataPacket];
    }
    if (sql.includes("FROM reviews r")) {
      return [{ id: 2, product_name: "DB product", rating: 4 } as unknown as RowDataPacket];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }, () => getAdminUserDetail(12));

  assert.equal(result.profile.full_name, "DB customer");
  assert.equal(result.orders[0]?.order_code, "DB-ORDER");
  assert.equal(result.reviews[0]?.product_name, "DB product");
  assert.equal("password_hash" in result.profile, false);
  assert.equal(statements.length, 3);
  for (const sql of statements) {
    assert.doesNotMatch(sql, /SELECT\s+\*/i);
    assert.doesNotMatch(sql, /password_hash|access_token|token_hash/i);
  }
  assert.match(statements[1] ?? "", /LIMIT 10/);
  assert.match(statements[2] ?? "", /LIMIT 10/);
});

test("admin user detail reports missing database users", async () => {
  await withDatabaseStub(() => [], async () => {
    await assert.rejects(getAdminUserDetail(999), (error: unknown) =>
      error instanceof AppError && error.statusCode === 404);
  });
});

test("admin product detail includes inactive variants and inventory data", async () => {
  const product = await withDatabaseStub((sql) => {
    if (sql.includes("FROM products p JOIN categories c")) {
      return [{
        id: 5,
        name: "DB product",
        status: "DRAFT",
        category_name: "DB category",
      } as unknown as RowDataPacket];
    }
    if (sql.includes("FROM product_variants v")) {
      return [{
        id: 8,
        status: "INACTIVE",
        quantity: 6,
        reserved_quantity: 2,
        available_quantity: 4,
      } as unknown as RowDataPacket];
    }
    if (sql.includes("FROM product_images")) return [];
    if (sql.includes("FROM reviews")) {
      return [{ average_rating: null, review_count: 0 } as unknown as RowDataPacket];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }, () => productDetail("5", true));

  assert.equal(product.status, "DRAFT");
  assert.equal((product.variants as RowDataPacket[])[0]?.status, "INACTIVE");
  assert.equal((product.variants as RowDataPacket[])[0]?.available_quantity, 4);
});
