import { Router } from "express";
import { env } from "../config/env";
import { requireAuth, issueToken } from "../middleware/auth";
import { asyncRoute, success } from "../utils/http";
import { loginSchema, registerSchema } from "../validators/schemas";
import { authenticateUser, registerCustomer } from "../services/auth";

export const authRouter = Router();
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 1000,
};

authRouter.post("/register", asyncRoute(async (request, response) => {
  const input = registerSchema.parse(request.body);
  const user = await registerCustomer(input);
  response.cookie("access_token", issueToken(user), cookieOptions);
  success(response, { user }, 201);
}));

authRouter.post("/login", asyncRoute(async (request, response) => {
  const input = loginSchema.parse(request.body);
  const user = await authenticateUser(input.identifier, input.password);
  response.cookie("access_token", issueToken(user), cookieOptions);
  success(response, { user });
}));

authRouter.post("/logout", (_request, response) => {
  response.clearCookie("access_token", { ...cookieOptions, maxAge: undefined });
  response.json({ success: true, data: { logged_out: true } });
});

authRouter.get("/me", requireAuth, (request, response) => {
  success(response, { user: request.user });
});
