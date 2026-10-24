import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { execute, rows } from "../config/database";
import type { AuthUser } from "../middleware/auth";
import { AppError } from "../utils/errors";
import type { z } from "zod";
import type { registerSchema } from "../validators/schemas";

type RegisterInput = z.infer<typeof registerSchema>;

export async function registerCustomer(input: RegisterInput): Promise<AuthUser> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const result = await execute(
    `INSERT INTO users (full_name, email, phone, password_hash, role, status)
     VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
    [input.full_name, input.email, input.phone ?? null, passwordHash],
  );
  return {
    id: String(result.insertId),
    role: "CUSTOMER",
    fullName: input.full_name,
    email: input.email,
    phone: input.phone ?? null,
  };
}

interface UserCredentialsRow extends RowDataPacket {
  id: string | number;
  fullName: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  role: AuthUser["role"];
  status: string;
}

export async function authenticateUser(identifier: string, password: string): Promise<AuthUser> {
  const users = await rows<UserCredentialsRow>(
    `SELECT id, full_name AS fullName, email, phone, password_hash AS passwordHash, role, status
     FROM users WHERE email=? OR phone=? LIMIT 1`,
    [identifier.toLowerCase(), identifier],
  );
  const user = users[0];
  if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError("Invalid credentials", 401);
  }
  return {
    id: String(user.id),
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
  };
}

interface ActiveUserRow extends RowDataPacket {
  id: string | number;
  role: AuthUser["role"];
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export async function getActiveUser(id: string): Promise<AuthUser | null> {
  const users = await rows<ActiveUserRow>(
    "SELECT id, role, full_name AS fullName, email, phone, status FROM users WHERE id=? LIMIT 1",
    [id],
  );
  const user = users[0];
  if (!user || user.status !== "ACTIVE") return null;
  return {
    id: String(user.id),
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
  };
}
