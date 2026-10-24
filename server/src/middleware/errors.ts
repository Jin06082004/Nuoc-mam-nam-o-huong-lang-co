import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

export const notFound: RequestHandler = (request, _response, next) => {
  next(new AppError(`Route ${request.method} ${request.path} was not found`, 404));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(422).json({
      success: false,
      message: "Request validation failed",
      errors: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.details,
    });
    return;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    const databaseErrors: Record<string, { status: number; message: string }> = {
      ER_DUP_ENTRY: { status: 409, message: "A record with the same unique value already exists" },
      ER_ROW_IS_REFERENCED_2: { status: 409, message: "This record is still referenced and cannot be removed" },
      ER_NO_REFERENCED_ROW_2: { status: 422, message: "A referenced record does not exist" },
      ER_CHECK_CONSTRAINT_VIOLATED: { status: 422, message: "The record violates a data constraint" },
      ER_DATA_TOO_LONG: { status: 422, message: "A field exceeds its allowed length" },
    };
    if (typeof code === "string" && databaseErrors[code]) {
      const databaseError = databaseErrors[code];
      response.status(databaseError.status).json({ success: false, message: databaseError.message, errors: [] });
      return;
    }
  }

  if (typeof error === "object" && error !== null && "type" in error) {
    if (error.type === "entity.parse.failed") {
      response.status(400).json({ success: false, message: "Malformed JSON request body", errors: [] });
      return;
    }
    if (error.type === "entity.too.large") {
      response.status(413).json({ success: false, message: "Request body is too large", errors: [] });
      return;
    }
  }

  console.error("Unhandled API error", error);
  response.status(500).json({
    success: false,
    message: "An unexpected server error occurred",
    errors: [],
  });
};
