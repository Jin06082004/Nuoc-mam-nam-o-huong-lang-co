import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, cleanupUser, phase5Enabled, startPhase5Api, stopPhase5Api, uniqueEmail } from "./phase5-helpers";
import bcrypt from "bcryptjs";

before(async () => {
  if (phase5Enabled) await startPhase5Api();
});

after(async () => {
  if (phase5Enabled) await stopPhase5Api();
});

test("registration, login, session refresh, logout, and invalid credentials", { skip: !phase5Enabled, timeout: 30000 }, async () => {
  const email = uniqueEmail();
  const password = "Phase5-Customer-Test-Password!2026";
  try {
    const registration = await apiRequest<{ user: { email: string; role: string } }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name: "Phase Five Customer", email, password }),
    });
    assert.equal(registration.response.status, 201);
    assert.equal(registration.payload.data?.user.role, "CUSTOMER");
    assert.equal(registration.payload.data?.user.email, email);
    assert.doesNotMatch(JSON.stringify(registration.payload), /password_hash/i);
    assert.ok(registration.cookie);

    const { pool } = await import("../src/config/database");
    const [credentialRows] = await pool.execute("SELECT password_hash FROM users WHERE email=?", [email]);
    const storedHash = (credentialRows as Array<{ password_hash: string }>)[0]?.password_hash;
    assert.match(storedHash ?? "", /^\$2[aby]\$/);
    assert.notEqual(storedHash, password);
    assert.equal(await bcrypt.compare(password, storedHash ?? ""), true);

    const refresh = await apiRequest<{ user: { email: string } }>("/api/auth/me", {}, registration.cookie);
    assert.equal(refresh.response.status, 200);
    assert.equal(refresh.payload.data?.user.email, email);

    const login = await apiRequest<{ user: { email: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: email, password }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.data?.user.email, email);
    assert.ok(login.cookie);

    const invalid = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: email, password: "incorrect-password" }),
    });
    assert.equal(invalid.response.status, 401);
    assert.equal(invalid.payload.message, "Invalid credentials");
    const unknownEmail = uniqueEmail();
    const unknown = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: unknownEmail, password: "incorrect-password" }),
    });
    assert.equal(unknown.response.status, 401);
    assert.equal(unknown.payload.message, invalid.payload.message);

    const jwt = await import("jsonwebtoken");
    const { env } = await import("../src/config/env");
    const expiredToken = jwt.default.sign({ role: "CUSTOMER" }, env.JWT_SECRET, {
      subject: "999999999",
      expiresIn: -1,
    });
    const expiredSession = await apiRequest("/api/auth/me", {}, `access_token=${expiredToken}`);
    assert.equal(expiredSession.response.status, 401);

    const logout = await apiRequest("/api/auth/logout", { method: "POST" }, login.cookie);
    assert.equal(logout.response.status, 200);
    const afterLogout = await apiRequest("/api/auth/me", {}, logout.cookie);
    assert.equal(afterLogout.response.status, 401);
  } finally {
    await cleanupUser(email);
  }
});
