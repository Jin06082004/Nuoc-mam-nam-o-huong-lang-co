import { Router } from "express";
import { z } from "zod";
import { checkDatabase } from "../config/database";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncRoute, success } from "../utils/http";
import { AppError } from "../utils/errors";
import { archiveCategory, archiveProduct, blogPostBySlug, createReview, deleteOwnedReview, deleteProductImage, deactivateVariant, listBlogPosts, listCategories, listProductReviews, listProducts, productDetail, productIdForVariant, relatedProducts, saveCategory, saveImage, saveProduct, saveVariant, setPrimaryImage, updateInventory, updateOwnedReview, updateProductImage } from "../services/catalog";
import { addCartItem, changeOrderStatus, clearCart, couponPreview, createOrder, getCart, getOrder, getOrderPayments, listOrders, removeCartItem, setCartItemQuantity } from "../services/commerce";
import { getAdminDashboardStats, getAdminUserDetail, listAdminInventory, listAdminReviews, listAdminUsers, listContent, setReviewStatus, updateUserRoleAndStatus } from "../services/admin";
import {
  cartItemSchema, categorySchema, checkoutSchema, couponValidationSchema, idParamsSchema, imageSchema,
  imageUpdateSchema, inventorySchema, paginationSchema, userAdminSchema,
  productParamsSchema, productSchema, reviewAdminQuerySchema, reviewSchema, reviewStatusSchema, statusSchema,
  updateCartItemSchema, variantParamsSchema, variantSchema, videoSchema,
} from "../validators/schemas";

export const catalogRouter = Router();
const admin = [requireAuth, requireRole("ADMIN")];

catalogRouter.get("/health", asyncRoute(async (_request, response) => {
  await checkDatabase();
  success(response, { message: "API is healthy", database: "connected" });
}));

catalogRouter.get("/categories", asyncRoute(async (_request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(_request.query);
  const result = await listCategories(false, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));

catalogRouter.get("/products", asyncRoute(async (request, response) => {
  const query = paginationSchema.parse(request.query);
  const result = await listProducts({ ...query, admin: false });
  response.json({ success: true, data: result.data, meta: { page: query.page, limit: query.limit, total: result.total } });
}));

catalogRouter.get("/products/:productId/related", asyncRoute(async (request, response) => {
  const { productId } = productParamsSchema.parse(request.params);
  success(response, await relatedProducts(productId));
}));

catalogRouter.get("/products/:productId/reviews", asyncRoute(async (request, response) => {
  const { productId } = productParamsSchema.parse(request.params);
  const query = paginationSchema.pick({ page: true, limit: true }).parse(request.query);
  const result = await listProductReviews(productId, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));

catalogRouter.get("/products/:productId", asyncRoute(async (request, response) => {
  const productId = z.string().min(1).parse(request.params.productId);
  success(response, await productDetail(productId, false));
}));

catalogRouter.post("/products/:productId/reviews", requireAuth, asyncRoute(async (request, response) => {
  const { productId } = productParamsSchema.parse(request.params);
  const input = reviewSchema.parse(request.body);
  const id = await createReview(productId, request.user!.id, input.rating, input.comment ?? null);
  success(response, { id, status: "PENDING" }, 201);
}));

catalogRouter.put("/reviews/:id", requireAuth, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const input = reviewSchema.parse(request.body);
  await updateOwnedReview(id, request.user!.id, input.rating, input.comment ?? null);
  success(response, { id, status: "PENDING" });
}));

catalogRouter.delete("/reviews/:id", requireAuth, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await deleteOwnedReview(id, request.user!.id);
  response.status(204).send();
}));

catalogRouter.get("/cart", requireAuth, asyncRoute(async (request, response) => {
  success(response, await getCart(request.user!.id));
}));
catalogRouter.post("/cart/items", requireAuth, asyncRoute(async (request, response) => {
  const input = cartItemSchema.parse(request.body);
  const result = await addCartItem(request.user!.id, input.variant_id, input.quantity);
  success(response, result, 201);
}));
catalogRouter.put("/cart/items/:id", requireAuth, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const { quantity } = updateCartItemSchema.parse(request.body);
  await setCartItemQuantity(request.user!.id, id, quantity);
  success(response, { id, quantity });
}));
catalogRouter.delete("/cart/items/:id", requireAuth, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await removeCartItem(request.user!.id, id);
  response.status(204).send();
}));
catalogRouter.delete("/cart", requireAuth, asyncRoute(async (request, response) => {
  await clearCart(request.user!.id);
  response.status(204).send();
}));
catalogRouter.post("/cart/clear", requireAuth, asyncRoute(async (request, response) => {
  await clearCart(request.user!.id);
  response.json({ success: true, data: { cleared: true } });
}));

catalogRouter.post("/orders", requireAuth, asyncRoute(async (request, response) => {
  const input = checkoutSchema.parse(request.body);
  const order = await createOrder(request.user!.id, input);
  success(response, order, 201);
}));
catalogRouter.get("/orders", requireAuth, asyncRoute(async (request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(request.query);
  const result = await listOrders(request.user!.id, false, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.get("/orders/:id", requireAuth, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  success(response, await getOrder(request.user!.id, false, id));
}));
catalogRouter.patch("/orders/:id/cancel", requireAuth, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await changeOrderStatus(id, "CANCELLED", request.user!.id);
  success(response, { id, status: "CANCELLED" });
}));
catalogRouter.get("/orders/:id/payment", requireAuth, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  success(response, await getOrderPayments(request.user!.id, id));
}));

catalogRouter.post("/coupons/validate", requireAuth, asyncRoute(async (request, response) => {
  const input = couponValidationSchema.parse(request.body);
  success(response, await couponPreview(input.code, input.subtotal));
}));

catalogRouter.get("/videos", asyncRoute(async (_request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(_request.query);
  const result = await listContent("videos", false, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.get("/social-links", asyncRoute(async (_request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(_request.query);
  const result = await listContent("social_links", false, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.get("/banners", asyncRoute(async (_request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(_request.query);
  const result = await listContent("banners", false, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.get("/blog/categories", asyncRoute(async (_request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(_request.query);
  const result = await listContent("blog_categories", false, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.get("/blog/posts", asyncRoute(async (request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(request.query);
  const result = await listBlogPosts(query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.get("/blog/posts/:slug", asyncRoute(async (request, response) => {
  const slug = z.string().min(1).parse(request.params.slug);
  success(response, await blogPostBySlug(slug));
}));

catalogRouter.get("/admin/categories", ...admin, asyncRoute(async (request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(request.query);
  const result = await listCategories(true, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.post("/admin/categories", ...admin, asyncRoute(async (request, response) => {
  const id = await saveCategory(categorySchema.parse(request.body));
  success(response, { id }, 201);
}));
catalogRouter.put("/admin/categories/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await saveCategory(categorySchema.parse(request.body), id);
  success(response, { id });
}));
catalogRouter.delete("/admin/categories/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await archiveCategory(id);
  success(response, { id, status: "ARCHIVED" });
}));

catalogRouter.get("/admin/products", ...admin, asyncRoute(async (request, response) => {
  const query = paginationSchema.parse(request.query);
  const result = await listProducts({ ...query, admin: true });
  response.json({ success: true, data: result.data, meta: { page: query.page, limit: query.limit, total: result.total } });
}));
catalogRouter.get("/admin/products/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  success(response, await productDetail(String(id), true));
}));
catalogRouter.post("/admin/products", ...admin, asyncRoute(async (request, response) => {
  const id = await saveProduct(productSchema.parse(request.body));
  success(response, { id }, 201);
}));
catalogRouter.put("/admin/products/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await saveProduct(productSchema.parse(request.body), id);
  success(response, { id });
}));
catalogRouter.delete("/admin/products/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await archiveProduct(id);
  success(response, { id, status: "ARCHIVED" });
}));
catalogRouter.post("/admin/products/:productId/variants", ...admin, asyncRoute(async (request, response) => {
  const { productId } = productParamsSchema.parse(request.params);
  const id = await saveVariant(productId, variantSchema.parse(request.body));
  success(response, { id }, 201);
}));
catalogRouter.put("/admin/variants/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const productId = await productIdForVariant(id);
  await saveVariant(productId, variantSchema.parse(request.body), id);
  success(response, { id });
}));
catalogRouter.delete("/admin/variants/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await deactivateVariant(id);
  success(response, { id, status: "INACTIVE" });
}));
catalogRouter.post("/admin/products/:productId/images", ...admin, asyncRoute(async (request, response) => {
  const { productId } = productParamsSchema.parse(request.params);
  const id = await saveImage(productId, imageSchema.parse(request.body));
  success(response, { id }, 201);
}));
catalogRouter.patch("/admin/product-images/:id/primary", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await setPrimaryImage(id);
  success(response, { id, is_primary: true });
}));
catalogRouter.put("/admin/product-images/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await updateProductImage(id, imageUpdateSchema.parse(request.body));
  success(response, { id });
}));
catalogRouter.delete("/admin/product-images/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  await deleteProductImage(id);
  response.status(204).send();
}));
catalogRouter.get("/admin/inventory", ...admin, asyncRoute(async (request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(request.query);
  const result = await listAdminInventory(query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.patch("/admin/inventory/:variantId", ...admin, asyncRoute(async (request, response) => {
  const { variantId } = variantParamsSchema.parse(request.params);
  const { quantity } = inventorySchema.parse(request.body);
  await updateInventory(variantId, quantity);
  success(response, { variant_id: variantId, quantity });
}));

catalogRouter.get("/admin/orders", ...admin, asyncRoute(async (request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(request.query);
  const result = await listOrders("", true, query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.get("/admin/dashboard/stats", ...admin, asyncRoute(async (_request, response) => {
  success(response, await getAdminDashboardStats());
}));
catalogRouter.get("/admin/orders/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  success(response, await getOrder("", true, id));
}));
catalogRouter.patch("/admin/orders/:id/status", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const input = statusSchema.parse(request.body);
  await changeOrderStatus(id, input.status, null);
  success(response, { id, status: input.status });
}));
catalogRouter.patch("/admin/reviews/:id/status", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const { status } = reviewStatusSchema.parse(request.body);
  await setReviewStatus(id, status);
  success(response, { id, status });
}));
catalogRouter.get("/admin/reviews", ...admin, asyncRoute(async (request, response) => {
  const query = reviewAdminQuerySchema.parse(request.query);
  const result = await listAdminReviews(query.page, query.limit, query.status);
  response.json({ success: true, data: result.data, meta: { page: query.page, limit: query.limit, total: result.total } });
}));
catalogRouter.get("/admin/users", ...admin, asyncRoute(async (request, response) => {
  const query = paginationSchema.pick({ page: true, limit: true }).parse(request.query);
  const result = await listAdminUsers(query.page, query.limit);
  response.json({ success: true, data: result.data, meta: { ...query, total: result.total } });
}));
catalogRouter.get("/admin/users/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  success(response, await getAdminUserDetail(id));
}));
catalogRouter.patch("/admin/users/:id", ...admin, asyncRoute(async (request, response) => {
  const { id } = idParamsSchema.parse(request.params);
  const input = userAdminSchema.parse(request.body);
  if (String(id) === request.user!.id && (input.role !== "ADMIN" || input.status !== "ACTIVE")) {
    throw new AppError("You cannot remove your own active administrator access", 409);
  }
  await updateUserRoleAndStatus(id, input.role, input.status);
  success(response, { id, ...input });
}));
