import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { apiRequest, cleanupUser, createTestUser, phase5Enabled, startPhase5Api, stopPhase5Api } from "./phase5-helpers";

before(async () => {
  if (phase5Enabled) await startPhase5Api();
});

after(async () => {
  if (phase5Enabled) await stopPhase5Api();
});

test("product discovery, cart, server-priced checkout, snapshot, stock, and cross-customer order access", { skip: !phase5Enabled, timeout: 30000 }, async () => {
  const { pool } = await import("../src/config/database");
  const marker = randomUUID().replaceAll("-", "");
  const customerEmail = `phase5-shop-${marker}@example.invalid`;
  const otherEmail = `phase5-other-${marker}@example.invalid`;
  let adminEmail = "";
  let categoryId = 0;
  let productId = 0;
  let variantId = 0;
  let customerId = 0;
  let otherId = 0;
  let orderId = 0;
  let cartId = 0;
  let originalSettings: Record<string, unknown> | undefined;
  let adminCookie = "";

  try {
    const { issueToken } = await import("../src/middleware/auth");
    const admin = await createTestUser("ADMIN");
    adminEmail = admin.email;
    const adminCookieToken = issueToken({
      id: admin.id, role: "ADMIN", fullName: "Test Admin", email: admin.email, phone: null,
    });
    adminCookie = `access_token=${adminCookieToken}`;
    const settings = await apiRequest<Record<string, unknown>>("/api/admin/settings", {}, adminCookie);
    assert.equal(settings.response.status, 200);
    originalSettings = settings.payload.data;
    const testSettings = { ...originalSettings, shipping_fee: 0, free_shipping_enabled: false };
    const updateSettings = await apiRequest("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(testSettings),
    }, adminCookie);
    assert.equal(updateSettings.response.status, 200);

    const [categoryResult] = await pool.execute(
      "INSERT INTO categories (name, slug, status, sort_order) VALUES (?, ?, 'ACTIVE', 0)",
      [`Phase 5 ${marker}`, `phase5-${marker}`],
    );
    categoryId = Number((categoryResult as { insertId: number }).insertId);
    const [productResult] = await pool.execute(
      "INSERT INTO products (category_id, name, slug, short_description, description, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
      [categoryId, `Phase 5 Product ${marker}`, `phase5-product-${marker}`, "Runtime validation fixture", "Temporary isolated validation fixture"],
    );
    productId = Number((productResult as { insertId: number }).insertId);
    const [variantResult] = await pool.execute(
      "INSERT INTO product_variants (product_id, sku, name, price, status) VALUES (?, ?, 'Test variant', 4000, 'ACTIVE')",
      [productId, `P5-${marker}`],
    );
    variantId = Number((variantResult as { insertId: number }).insertId);
    await pool.execute("INSERT INTO inventory (variant_id, quantity, reserved_quantity) VALUES (?, 2, 0)", [variantId]);

    const registration = await apiRequest<{ user: { id: string } }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name: `Phase 5 Customer ${marker}`, email: customerEmail, password: "Phase5-Shop-Customer-Password!2026" }),
    });
    assert.equal(registration.response.status, 201);
    customerId = Number(registration.payload.data?.user.id);
    const customerCookie = registration.cookie;

    const listing = await apiRequest<Array<{ slug: string }>>(`/api/products?search=phase5-product-${marker}&limit=10`);
    assert.equal(listing.response.status, 200);
    assert.ok(listing.payload.data?.some((product) => product.slug === `phase5-product-${marker}`));
    const detail = await apiRequest<{ name: string; variants: Array<{ id: number; price: string | number }> }>(
      `/api/products/phase5-product-${marker}`,
    );
    assert.equal(detail.response.status, 200);
    assert.equal(Number(detail.payload.data?.variants[0]?.price), 4000);

    const add = await apiRequest("/api/cart/items", {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, quantity: 2 }),
    }, customerCookie);
    assert.equal(add.response.status, 201);
    const cart = await apiRequest<{ id: number; items: Array<{ id: number; quantity: number }> }>("/api/cart", {}, customerCookie);
    assert.equal(cart.response.status, 200);
    assert.equal(cart.payload.data?.items[0]?.quantity, 2);
    cartId = Number(cart.payload.data?.id);

    const order = await apiRequest<{ id: number; subtotal: string | number; total: string | number }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        payment_method: "COD",
        customer_name: `Phase 5 Customer ${marker}`,
        customer_phone: "0900000000",
        shipping_address_line: "Isolated test address",
        shipping_province: "Da Nang",
        price: 1,
        total: 1,
      }),
    }, customerCookie);
    assert.equal(order.response.status, 201);
    orderId = Number(order.payload.data?.id);
    assert.equal(Number(order.payload.data?.subtotal), 8000);
    assert.equal(Number(order.payload.data?.total), 8000);

    await pool.execute("UPDATE product_variants SET price=99000 WHERE id=?", [variantId]);
    const [snapshot] = await pool.execute(
      "SELECT unit_price, quantity FROM order_items WHERE order_id=?",
      [orderId],
    );
    assert.equal(Number((snapshot as Array<{ unit_price: number; quantity: number }>)[0]?.unit_price), 4000);
    assert.equal(Number((snapshot as Array<{ unit_price: number; quantity: number }>)[0]?.quantity), 2);
    const [stock] = await pool.execute("SELECT quantity FROM inventory WHERE variant_id=?", [variantId]);
    assert.equal(Number((stock as Array<{ quantity: number }>)[0]?.quantity), 0);

    const { issueToken: issue } = await import("../src/middleware/auth");
    const otherUser = {
      id: "2", role: "CUSTOMER" as const, fullName: "Other Customer", email: otherEmail, phone: null,
    };
    const other = await createTestUser("CUSTOMER", otherEmail);
    otherId = Number(other.id);
    const otherToken = issue({ ...otherUser, id: other.id });
    const oversell = await apiRequest("/api/cart/items", {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    }, `access_token=${otherToken}`);
    assert.equal(oversell.response.status, 409);
    const [stockAfterOversell] = await pool.execute("SELECT quantity FROM inventory WHERE variant_id=?", [variantId]);
    assert.equal(Number((stockAfterOversell as Array<{ quantity: number }>)[0]?.quantity), 0);
    const privateOrder = await apiRequest(`/api/orders/${orderId}`, {}, `access_token=${otherToken}`);
    assert.equal(privateOrder.response.status, 404);
  } finally {
    if (originalSettings && adminCookie) {
      await apiRequest("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(originalSettings),
      }, adminCookie);
    }
    if (orderId) {
      await pool.execute("DELETE FROM payments WHERE order_id=?", [orderId]);
      await pool.execute("DELETE FROM order_items WHERE order_id=?", [orderId]);
      await pool.execute("DELETE FROM coupon_usages WHERE order_id=?", [orderId]);
      await pool.execute("DELETE FROM orders WHERE id=?", [orderId]);
    }
    if (cartId) {
      await pool.execute("DELETE FROM cart_items WHERE cart_id=?", [cartId]);
      await pool.execute("DELETE FROM carts WHERE id=?", [cartId]);
    }
    if (variantId) {
      await pool.execute("DELETE FROM inventory WHERE variant_id=?", [variantId]);
      await pool.execute("DELETE FROM product_variants WHERE id=?", [variantId]);
    }
    if (productId) {
      await pool.execute("DELETE FROM product_images WHERE product_id=?", [productId]);
      await pool.execute("DELETE FROM products WHERE id=?", [productId]);
    }
    if (categoryId) await pool.execute("DELETE FROM categories WHERE id=?", [categoryId]);
    if (customerId) await pool.execute("DELETE FROM users WHERE id=?", [customerId]);
    if (otherId) await pool.execute("DELETE FROM users WHERE id=?", [otherId]);
    if (adminEmail) await cleanupUser(adminEmail);
  }
});
