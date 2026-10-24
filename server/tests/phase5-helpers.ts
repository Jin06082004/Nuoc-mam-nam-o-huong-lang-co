import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

export const phase5Enabled = process.env.PHASE5_TEST_DATABASE === "1"
  && /^nam_o_phase5_test_[a-z0-9_]+$/.test(process.env.DATABASE_NAME ?? "");

let server: Server | undefined;
let baseUrl = "";

export async function startPhase5Api(): Promise<void> {
  assert.equal(phase5Enabled, true, "Phase 5 integration tests require an isolated nam_o_phase5_test_* database");
  const { app } = await import("../src/app");
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
}

export async function stopPhase5Api(): Promise<void> {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => error ? reject(error) : resolve());
    });
  }
  if (server) {
    const { pool } = await import("../src/config/database");
    await pool.end();
  }
}

export interface ApiResult<T = Record<string, unknown>> {
  response: Response;
  payload: { success?: boolean; data?: T; message?: string };
  cookie: string;
}

export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
  cookie = "",
): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const cookieHeader = response.headers.get("set-cookie") ?? "";
  const payload = response.status === 204
    ? {}
    : await response.json() as { success?: boolean; data?: T; message?: string };
  return {
    response,
    payload,
    cookie: cookieHeader.split(";")[0] ?? "",
  };
}

export function uniqueEmail(): string {
  return `phase5-${randomUUID()}@example.invalid`;
}

export async function createTestUser(role: "CUSTOMER" | "ADMIN", email = uniqueEmail()): Promise<{ id: string; email: string }> {
  const { pool } = await import("../src/config/database");
  const hash = await bcrypt.hash(`Phase5-${randomUUID()}-Password!`, 12);
  const [result] = await pool.execute(
    "INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
    [`Phase 5 ${role}`, email, hash, role],
  );
  return { id: String((result as { insertId: number }).insertId), email };
}

export async function cleanupUser(email: string): Promise<void> {
  const { pool } = await import("../src/config/database");
  await pool.execute("DELETE FROM users WHERE email=?", [email]);
}

export async function login(email: string, password: string): Promise<string> {
  const result = await apiRequest<{ user: { role: string } }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: email, password }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.data?.user.role, "ADMIN");
  assert.ok(result.cookie);
  return result.cookie;
}
