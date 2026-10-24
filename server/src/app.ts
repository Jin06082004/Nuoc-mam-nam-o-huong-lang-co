import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env";
import { adminContentRouter } from "./routes/admin-content";
import { authRouter } from "./routes/auth";
import { catalogRouter } from "./routes/catalog";
import { settingsRouter } from "./routes/settings";
import { errorHandler, notFound } from "./middleware/errors";
import { AppError } from "./utils/errors";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
const allowedOrigins = new Set([
  env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      (env.NODE_ENV === "development" && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin))
    ) {
      return callback(null, true);
    }
    callback(new AppError("Origin is not allowed by CORS", 403));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts", errors: [] },
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api", catalogRouter);
app.use("/api", settingsRouter);
app.use("/api", adminContentRouter);
app.use(notFound);
app.use(errorHandler);
