import { Router } from "express";
import type { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { imageUpload } from "../middleware/upload";
import { deactivateContent, listContent, saveContent, setContentActive, type ContentInputs } from "../services/admin";
import { asyncRoute, success } from "../utils/http";
import { AppError } from "../utils/errors";
import { activeStatusSchema, idParamsSchema, bannerSchema, blogCategorySchema, blogPostSchema, couponSchema, paginationSchema, socialLinkSchema, videoSchema } from "../validators/schemas";

export const adminContentRouter = Router();
adminContentRouter.use("/admin", requireAuth, requireRole("ADMIN"));

adminContentRouter.post("/admin/uploads", (req, res, next) => {
  imageUpload.fields([{ name: "file", maxCount: 1 }, { name: "image", maxCount: 1 }])(req, res, (err) => {
    if (err) return next(err);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const uploaded = files?.file?.[0] || files?.image?.[0];
    if (!uploaded) {
      return next(new AppError("Vui lòng chọn tệp hình ảnh để tải lên", 400));
    }
    const fileUrl = `/uploads/${uploaded.filename}`;
    success(res, {
      url: fileUrl,
      filename: uploaded.filename,
      size: uploaded.size,
      mimetype: uploaded.mimetype,
    }, 201);
  });
});

function contentRoutes<T extends "videos" | "social_links" | "banners" | "blog_categories" | "blog_posts" | "coupons">(
  table: T,
  schema: { parse(input: unknown): ContentInputs[T] },
  path: string,
): void {
  adminContentRouter.get(path, asyncRoute(async (request, response) => {
    const query = paginationSchema.pick({ page: true, limit: true }).parse(request.query);
    const result = await listContent(table, true, query.page, query.limit);
    response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
  }));
  adminContentRouter.post(path, asyncRoute(async (request, response) => {
    const id = await saveContent(table, schema.parse(request.body));
    success(response, { id }, 201);
  }));
  adminContentRouter.put(`${path}/:id`, asyncRoute(async (request, response) => {
    const { id } = idParamsSchema.parse(request.params);
    await saveContent(table, schema.parse(request.body), id);
    success(response, { id });
  }));
  adminContentRouter.delete(`${path}/:id`, asyncRoute(async (request, response) => {
    const { id } = idParamsSchema.parse(request.params);
    await deactivateContent(table, id);
    success(response, { id, active: false });
  }));
}

contentRoutes("videos", videoSchema, "/admin/videos");
contentRoutes("social_links", socialLinkSchema, "/admin/social-links");
contentRoutes("banners", bannerSchema, "/admin/banners");
contentRoutes("blog_categories", blogCategorySchema, "/admin/blog/categories");
contentRoutes("blog_posts", blogPostSchema, "/admin/blog/posts");
contentRoutes("coupons", couponSchema, "/admin/coupons");

for (const path of ["/admin/videos/:id/status", "/admin/social-links/:id/status"]) {
  adminContentRouter.patch(path, asyncRoute(async (request, response) => {
    const { id } = idParamsSchema.parse(request.params);
    const { is_active } = activeStatusSchema.parse(request.body);
    const table = path.startsWith("/admin/videos") ? "videos" : "social_links";
    await setContentActive(table, id, is_active);
    success(response, { id, is_active });
  }));
}
