import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { readPublicStoreSettings, readStoreSettings, updateStoreSettings } from "../services/settings";
import { asyncRoute, success } from "../utils/http";
import { storeSettingsSchema } from "../validators/schemas";

export const settingsRouter = Router();

settingsRouter.get("/settings", asyncRoute(async (_request, response) => {
  success(response, await readPublicStoreSettings());
}));

settingsRouter.get("/admin/settings", requireAuth, requireRole("ADMIN"), asyncRoute(async (_request, response) => {
  success(response, await readStoreSettings());
}));

settingsRouter.put("/admin/settings", requireAuth, requireRole("ADMIN"), asyncRoute(async (request, response) => {
  const settings = storeSettingsSchema.parse(request.body);
  await updateStoreSettings(settings);
  success(response, await readStoreSettings());
}));
