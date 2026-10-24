import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, test } from "node:test";

let server: Server;
let baseUrl: string;

before(async () => {
  process.env.DATABASE_HOST = "127.0.0.1";
  process.env.DATABASE_PORT = "3306";
  process.env.DATABASE_NAME = "nam_o_fish_sauce";
  process.env.DATABASE_USER = "test";
  process.env.DATABASE_PASSWORD = "test";
  process.env.JWT_SECRET = "test-only-secret-that-is-not-used-for-a-session";
  process.env.FRONTEND_URL = "http://localhost:5173";
  process.env.NODE_ENV = "test";
  process.env.SHIPPING_FEE = "0";

  const { app } = await import("../src/app");
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("HTTP validation, malformed JSON, and unknown routes have consistent errors", async () => {
  const invalidRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ full_name: "x" }),
  });
  assert.equal(invalidRegistration.status, 422);
  assert.equal((await invalidRegistration.json()).success, false);

  const invalidPagination = await fetch(`${baseUrl}/api/products?limit=1000000`);
  assert.equal(invalidPagination.status, 422);
  assert.equal((await invalidPagination.json()).success, false);

  const malformedJson = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformedJson.status, 400);
  assert.equal((await malformedJson.json()).success, false);

  const unknownRoute = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(unknownRoute.status, 404);
  assert.equal((await unknownRoute.json()).success, false);
});

test("admin routes require authentication", async () => {
  for (const path of [
    "/api/admin/videos",
    "/api/admin/dashboard/stats",
    "/api/admin/products/1",
    "/api/admin/users/1",
    "/api/admin/settings",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).success, false, path);
  }
});

test("store settings are public-read, ADMIN-write only, and do not leak disabled bank details", async () => {
  const { pool } = await import("../src/config/database");
  const { issueToken } = await import("../src/middleware/auth");
  const descriptor = Object.getOwnPropertyDescriptor(pool, "execute");
  let writes = 0;
  Object.defineProperty(pool, "execute", {
    configurable: true,
    value: async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes("FROM users WHERE id=?")) {
        const isAdmin = values[0] === "1";
        return [[{
          id: values[0],
          role: isAdmin ? "ADMIN" : "CUSTOMER",
          fullName: isAdmin ? "Admin" : "Customer",
          email: null,
          phone: null,
          status: "ACTIVE",
        }], []];
      }
      if (sql.includes("FROM store_settings")) {
        return [[{
          store_name: "Nước mắm Nam Ô Hương Làng Cổ",
          store_description: null,
          logo_url: null,
          store_address: null,
          contact_phone: null,
          contact_email: null,
          shipping_fee: "12000.00",
          free_shipping_enabled: 0,
          free_shipping_minimum: null,
          customer_cancellation_statuses: '["PENDING"]',
          cod_enabled: 1,
          bank_transfer_enabled: 0,
          bank_name: "Hidden Bank",
          bank_account_number: "12345678",
          bank_account_holder: "Hidden Person",
          bank_branch: null,
          facebook_url: null,
          tiktok_url: null,
          youtube_url: null,
        }], []];
      }
      if (sql.includes("INSERT INTO store_settings")) {
        writes += 1;
        assert.ok(values.includes(JSON.stringify(["PENDING", "CONFIRMED"])));
        return [{ affectedRows: 1, insertId: 1 }, []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  try {
    const publicResponse = await fetch(`${baseUrl}/api/settings`);
    assert.equal(publicResponse.status, 200);
    const publicBody = await publicResponse.json() as { data: Record<string, unknown> };
    assert.equal(publicBody.data.shipping_fee, 12000);
    assert.equal(publicBody.data.bank_name, null);
    assert.equal("customer_cancellation_statuses" in publicBody.data, false);

    const customerToken = issueToken({
      id: "2", role: "CUSTOMER", fullName: "Customer", email: null, phone: null,
    });
    const forbidden = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { cookie: `access_token=${customerToken}` },
    });
    assert.equal(forbidden.status, 403);

    const adminToken = issueToken({
      id: "1", role: "ADMIN", fullName: "Admin", email: null, phone: null,
    });
    const adminSettings = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { cookie: `access_token=${adminToken}` },
    });
    assert.equal(adminSettings.status, 200);
    const adminBody = await adminSettings.json() as { data: Record<string, unknown> };
    assert.equal(adminBody.data.bank_name, "Hidden Bank");

    const payload = {
      store_name: "Nước mắm Nam Ô Hương Làng Cổ",
      store_description: null,
      logo_url: null,
      store_address: null,
      contact_phone: null,
      contact_email: null,
      shipping_fee: 12000,
      free_shipping_enabled: false,
      free_shipping_minimum: null,
      customer_cancellation_statuses: ["PENDING", "CONFIRMED"],
      cod_enabled: true,
      bank_transfer_enabled: false,
      bank_name: null,
      bank_account_number: null,
      bank_account_holder: null,
      bank_branch: null,
      facebook_url: null,
      tiktok_url: null,
      youtube_url: null,
    };
    const customerWrite = await fetch(`${baseUrl}/api/admin/settings`, {
      method: "PUT",
      headers: { cookie: `access_token=${customerToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(customerWrite.status, 403);

    const invalidAdminWrite = await fetch(`${baseUrl}/api/admin/settings`, {
      method: "PUT",
      headers: { cookie: `access_token=${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ ...payload, bank_transfer_enabled: true }),
    });
    assert.equal(invalidAdminWrite.status, 422);
    assert.equal(writes, 0);

    const validAdminWrite = await fetch(`${baseUrl}/api/admin/settings`, {
      method: "PUT",
      headers: { cookie: `access_token=${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(validAdminWrite.status, 200);
    assert.equal(writes, 1);
  } finally {
    if (descriptor) Object.defineProperty(pool, "execute", descriptor);
    else delete (pool as unknown as { execute?: unknown }).execute;
  }
});

test("customer order cancellation follows the configured statuses", async () => {
  const { pool } = await import("../src/config/database");
  const { changeOrderStatus } = await import("../src/services/commerce");
  const descriptor = Object.getOwnPropertyDescriptor(pool, "getConnection");
  let rolledBack = false;
  let released = false;
  const connection = {
    beginTransaction: async () => undefined,
    execute: async (sql: string) => {
      if (sql.startsWith("SELECT id, status, user_id FROM orders")) {
        return [[{ id: 20, status: "CONFIRMED", user_id: 2 }], []];
      }
      if (sql.includes("FROM store_settings")) {
        return [[{
          store_name: "Cửa hàng",
          store_description: null,
          logo_url: null,
          store_address: null,
          contact_phone: null,
          contact_email: null,
          shipping_fee: 0,
          free_shipping_enabled: 0,
          free_shipping_minimum: null,
          customer_cancellation_statuses: ["PENDING"],
          cod_enabled: 1,
          bank_transfer_enabled: 0,
          bank_name: null,
          bank_account_number: null,
          bank_account_holder: null,
          bank_branch: null,
          facebook_url: null,
          tiktok_url: null,
          youtube_url: null,
        }], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    rollback: async () => { rolledBack = true; },
    release: () => { released = true; },
  };
  Object.defineProperty(pool, "getConnection", {
    configurable: true,
    value: async () => connection,
  });

  try {
    await assert.rejects(changeOrderStatus(20, "CANCELLED", "2"), { statusCode: 409 });
    assert.equal(rolledBack, true);
    assert.equal(released, true);
  } finally {
    if (descriptor) Object.defineProperty(pool, "getConnection", descriptor);
    else delete (pool as unknown as { getConnection?: unknown }).getConnection;
  }
});

test("dashboard stats reject an authenticated customer and allow an active admin", async () => {
  const { pool } = await import("../src/config/database");
  const { issueToken } = await import("../src/middleware/auth");
  const descriptor = Object.getOwnPropertyDescriptor(pool, "execute");
  Object.defineProperty(pool, "execute", {
    configurable: true,
    value: async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes("FROM users WHERE id=?")) {
        const isAdmin = values[0] === "1";
        return [[{
          id: values[0],
          role: isAdmin ? "ADMIN" : "CUSTOMER",
          fullName: isAdmin ? "Admin" : "Customer",
          email: null,
          phone: null,
          status: "ACTIVE",
        }], []];
      }
      if (sql.includes("AS total_orders")) {
        return [[{
          total_orders: 4,
          pending_orders: 1,
          revenue: "250.00",
          total_products: 3,
          total_customers: 2,
          low_stock_variants: 1,
        }], []];
      }
      if (sql.includes("FROM orders ORDER BY") || sql.includes("FROM reviews r")) return [[], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  try {
    const customerToken = issueToken({
      id: "2", role: "CUSTOMER", fullName: "Customer", email: null, phone: null,
    });
    const forbidden = await fetch(`${baseUrl}/api/admin/dashboard/stats`, {
      headers: { cookie: `access_token=${customerToken}` },
    });
    assert.equal(forbidden.status, 403);

    const adminToken = issueToken({
      id: "1", role: "ADMIN", fullName: "Admin", email: null, phone: null,
    });
    const allowed = await fetch(`${baseUrl}/api/admin/dashboard/stats`, {
      headers: { cookie: `access_token=${adminToken}` },
    });
    assert.equal(allowed.status, 200);
    const body = await allowed.json() as { success: boolean; data: { totalOrders: number; revenue: number } };
    assert.equal(body.success, true);
    assert.equal(body.data.totalOrders, 4);
    assert.equal(body.data.revenue, 250);
  } finally {
    if (descriptor) Object.defineProperty(pool, "execute", descriptor);
    else delete (pool as unknown as { execute?: unknown }).execute;
  }
});
