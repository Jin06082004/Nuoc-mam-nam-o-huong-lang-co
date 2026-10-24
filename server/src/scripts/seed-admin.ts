import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import type { RowDataPacket } from "mysql2";
import mysql from "mysql2/promise";

dotenv.config();

async function seedAdmin(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Admin development seed is disabled in production");
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME?.trim() || "Development Admin";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (!password || password.length < 10 || password.length > 128) {
    throw new Error("ADMIN_PASSWORD must be between 10 and 128 characters");
  }
  if (fullName.length < 2 || fullName.length > 150) {
    throw new Error("ADMIN_FULL_NAME must be between 2 and 150 characters");
  }

  const required = ["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER"] as const;
  if (required.some((key) => !process.env[key]) || process.env.DATABASE_PASSWORD === undefined) {
    throw new Error("Database connection configuration is incomplete");
  }

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    charset: "utf8mb4",
  });

  try {
    await connection.beginTransaction();
    const [matches] = await connection.execute<RowDataPacket[]>(
      "SELECT id, role FROM users WHERE email=? LIMIT 1 FOR UPDATE",
      [email],
    );
    const existing = matches[0];

    if (existing) {
      if (existing.role !== "ADMIN") {
        await connection.execute("UPDATE users SET role='ADMIN' WHERE id=?", [existing.id]);
      }
      await connection.commit();
      console.info(existing.role === "ADMIN" ? "Admin account already exists." : "Existing account promoted to ADMIN.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status)
       VALUES (?, ?, NULL, ?, 'ADMIN', 'ACTIVE')`,
      [fullName, email, passwordHash],
    );
    await connection.commit();
    console.info("Development admin account created.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

seedAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Admin seed failed";
  console.error(message);
  process.exitCode = 1;
});
