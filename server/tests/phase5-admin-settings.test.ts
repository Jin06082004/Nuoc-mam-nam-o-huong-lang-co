import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, cleanupUser, createTestUser, login, phase5Enabled, startPhase5Api, stopPhase5Api } from "./phase5-helpers";

before(async () => {
  if (phase5Enabled) await startPhase5Api();
});

after(async () => {
  if (phase5Enabled) await stopPhase5Api();
});

test("anonymous, CUSTOMER, and ADMIN authorization plus Settings write/read persistence", { skip: !phase5Enabled, timeout: 30000 }, async () => {
  const customer = await createTestUser("CUSTOMER");
  const admin = await createTestUser("ADMIN");
  let originalSettings: Record<string, unknown> | undefined;
  let adminCookie = "";
  try {
    const anonymous = await apiRequest("/api/admin/settings");
    assert.equal(anonymous.response.status, 401);

    const { issueToken } = await import("../src/middleware/auth");
    const customerToken = issueToken({
      id: customer.id, role: "CUSTOMER", fullName: "Phase 5 CUSTOMER", email: customer.email, phone: null,
    });
    const customerSettings = await apiRequest("/api/admin/settings", {}, `access_token=${customerToken}`);
    assert.equal(customerSettings.response.status, 403);

    const adminPassword = "Phase5-Admin-Verification-Password!2026";
    const bcrypt = await import("bcryptjs");
    const { pool } = await import("../src/config/database");
    await pool.execute(
      "UPDATE users SET password_hash=? WHERE email=?",
      [await bcrypt.default.hash(adminPassword, 12), admin.email],
    );
    adminCookie = await login(admin.email, adminPassword);

    const adminSettings = await apiRequest<Record<string, unknown>>("/api/admin/settings", {}, adminCookie);
    assert.equal(adminSettings.response.status, 200);
    assert.equal(adminSettings.payload.success, true);
    originalSettings = adminSettings.payload.data;

    const updatedSettings = { ...originalSettings, store_description: "Phase 5 isolated persistence check" };
    const update = await apiRequest<Record<string, unknown>>("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(updatedSettings),
    }, adminCookie);
    assert.equal(update.response.status, 200);
    assert.equal((update.payload.data as Record<string, unknown>).store_description, updatedSettings.store_description);

    const publicSettings = await apiRequest<Record<string, unknown>>("/api/settings");
    assert.equal(publicSettings.response.status, 200);
    assert.equal(publicSettings.payload.data?.store_description, updatedSettings.store_description);
    assert.equal("customer_cancellation_statuses" in (publicSettings.payload.data ?? {}), false);
    const [storedRows] = await pool.execute("SELECT store_description FROM store_settings WHERE id=1");
    assert.equal((storedRows as Array<{ store_description: string }>)[0]?.store_description, updatedSettings.store_description);

    const invalidPayloads = [
      { ...updatedSettings, contact_email: "not-an-email" },
      { ...updatedSettings, facebook_url: "javascript:alert(1)" },
      { ...updatedSettings, shipping_fee: -1 },
      { ...updatedSettings, free_shipping_minimum: -1 },
      { ...updatedSettings, cod_enabled: "true" },
      { ...updatedSettings, store_name: "x".repeat(151) },
    ];
    for (const payload of invalidPayloads) {
      const invalid = await apiRequest("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      }, adminCookie);
      assert.equal(invalid.response.status, 422);
      assert.equal(invalid.payload.success, false);
    }
  } finally {
    if (originalSettings && adminCookie) {
      await apiRequest("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(originalSettings),
      }, adminCookie);
    }
    await cleanupUser(customer.email);
    await cleanupUser(admin.email);
  }
});
