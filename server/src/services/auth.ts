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

interface PasswordResetRow extends RowDataPacket {
  id: number;
  email: string;
  otp_code: string;
  expires_at: Date;
  used_at: Date | null;
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUsers = await rows<ActiveUserRow>(
    "SELECT id, role, full_name AS fullName, email, phone, status FROM users WHERE email=? AND status='ACTIVE' LIMIT 1",
    [normalizedEmail],
  );
  const user = existingUsers[0];

  // Return generic success even if user not found to prevent account enumeration
  if (!user || !user.email) {
    return {
      success: true,
      message: "Nếu email tồn tại trong hệ thống, mã xác thực (OTP) đã được gửi.",
    };
  }

  // Generate secure 6-digit OTP code
  const crypto = await import("crypto");
  const otp = crypto.randomInt(100000, 1000000).toString();

  // Invalidate any existing unused OTPs for this email
  await execute(
    "UPDATE password_resets SET used_at = NOW() WHERE email = ? AND used_at IS NULL",
    [normalizedEmail],
  );

  // Insert new OTP with 15-minute validity
  await execute(
    "INSERT INTO password_resets (email, otp_code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))",
    [normalizedEmail, otp],
  );

  // Send branded OTP email via SMTP
  const { sendPasswordResetOtpEmail } = await import("./mail");
  void sendPasswordResetOtpEmail({
    email: user.email,
    fullName: user.fullName,
    otp,
  }).catch((err) => {
    console.error("[AUTH] Error sending password reset email:", err);
  });

  return {
    success: true,
    message: "Mã xác thực (OTP) đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư.",
  };
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const resetRows = await rows<PasswordResetRow>(
    `SELECT id, email, otp_code, expires_at, used_at
     FROM password_resets
     WHERE email = ? AND otp_code = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [normalizedEmail, otp.trim()],
  );

  const resetRecord = resetRows[0];
  if (!resetRecord) {
    throw new AppError("Mã xác thực không hợp lệ hoặc đã hết hạn (15 phút). Vui lòng yêu cầu mã mới.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update user's password
  const updateResult = await execute(
    "UPDATE users SET password_hash = ? WHERE email = ? AND status = 'ACTIVE'",
    [passwordHash, normalizedEmail],
  );

  if (updateResult.affectedRows === 0) {
    throw new AppError("Không tìm thấy tài khoản hợp lệ để cập nhật mật khẩu.", 404);
  }

  // Mark token as used
  await execute("UPDATE password_resets SET used_at = NOW() WHERE id = ?", [resetRecord.id]);

  return {
    success: true,
    message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
  };
}
