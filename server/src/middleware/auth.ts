import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { asyncRoute } from "../utils/http";
import { getActiveUser } from "../services/auth";

export type UserRole = "CUSTOMER" | "ADMIN" | "STAFF";
export interface AuthUser {
  id: string;
  role: UserRole;
  fullName: string;
  email: string | null;
  phone: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const claimsSchema = z.object({ sub: z.string(), role: z.enum(["CUSTOMER", "ADMIN", "STAFF"]) });

export function issueToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: "1h" });
}

export const requireAuth: RequestHandler = asyncRoute(async (request, _response, next) => {
  const token = request.cookies?.access_token as string | undefined;
  if (!token) throw new AppError("Authentication is required", 401);

  let payload: JwtPayload;
  try {
    const verified = jwt.verify(token, env.JWT_SECRET);
    if (typeof verified === "string") throw new Error("Invalid token payload");
    payload = verified;
  } catch {
    throw new AppError("Authentication token is invalid or expired", 401);
  }

  const claims = claimsSchema.safeParse(payload);
  if (!claims.success) throw new AppError("Authentication token is invalid", 401);

  const user = await getActiveUser(claims.data.sub);
  if (!user) throw new AppError("Authentication is required", 401);
  request.user = user;
  next();
});

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) return next(new AppError("Authentication is required", 401));
    if (!roles.includes(request.user.role)) return next(new AppError("You do not have permission to perform this action", 403));
    next();
  };
}
