import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "./errors";

export function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function success(response: Response, data: unknown, status = 200): void {
  response.status(status).json({ success: true, data });
}

export function pagination(request: Request): { page: number; limit: number; offset: number } {
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError("page must be >= 1 and limit must be between 1 and 100", 422);
  }
  return { page, limit, offset: (page - 1) * limit };
}
