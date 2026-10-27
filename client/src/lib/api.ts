import type {
  ApiFailure,
  ApiSuccess,
  Banner,
  BlogPost,
  Cart,
  Category,
  AdminStoreSettings,
  Order,
  PageResult,
  Product,
  Review,
  SocialLink,
  StoreSettings,
  User,
  Video,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3001/api";
const API_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: ApiFailure["errors"] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type AdminRecord = Record<string, unknown>;

export interface AdminDashboardStats {
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockVariants: number;
  lowStockThreshold: number;
  recentOrders: Array<{
    id: number;
    order_code: string;
    status: string;
    total_amount: string | number;
    customer_name: string;
    created_at: string;
  }>;
  recentReviews: Array<{
    id: number;
    rating: number;
    comment: string | null;
    status: string;
    product_name: string;
    customer_name: string | null;
    created_at: string;
  }>;
}

export interface AdminUserDetail {
  profile: AdminRecord;
  orders: AdminRecord[];
  reviews: AdminRecord[];
}

async function request(path: string, init: RequestInit & { method: "DELETE" }): Promise<void>;
async function request<T>(path: string, init?: RequestInit): Promise<T>;
async function request<T>(path: string, init: RequestInit = {}): Promise<T | void> {
  const payload = await requestPayload<T>(path, init);
  return payload?.data;
}

async function requestPage<T>(path: string): Promise<PageResult<T>> {
  const payload = await requestPayload<T[]>(path);
  if (!payload || !Array.isArray(payload.data) || !payload.meta) {
    throw new ApiError("Máy chủ trả về dữ liệu phân trang không hợp lệ.", 502);
  }
  return { data: payload.data, meta: payload.meta };
}

async function requestPayload<T>(path: string, init: RequestInit = {}): Promise<ApiSuccess<T> | undefined> {
  let response: Response;
  try {
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(API_TIMEOUT_MS)])
        : AbortSignal.timeout(API_TIMEOUT_MS),
      headers: {
        ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new ApiError("Máy chủ phản hồi quá lâu. Vui lòng thử lại sau.", 0);
    }
    throw new ApiError("Không thể kết nối máy chủ. Vui lòng thử lại sau.", 0);
  }

  if (response.status === 204) {
    if (init.method !== "DELETE") {
      throw new ApiError("Máy chủ trả về phản hồi không hợp lệ.", response.status);
    }
    return undefined;
  }

  let payload: ApiSuccess<T> | ApiFailure;
  try {
    payload = await response.json() as ApiSuccess<T> | ApiFailure;
  } catch {
    throw new ApiError("Máy chủ trả về phản hồi không hợp lệ.", response.status);
  }
  if (!response.ok || payload.success === false) {
    const error = payload as ApiFailure;
    throw new ApiError(error.message || "Đã có lỗi xảy ra. Vui lòng thử lại.", response.status, error.errors);
  }
  return payload as ApiSuccess<T>;
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && String(value).length) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const api = {
  request,
  products(params: { page?: number; limit?: number; search?: string; category?: string; sort?: string } = {}) {
    return requestPage<Product>(`/products${queryString(params)}`);
  },
  product(idOrSlug: string) {
    return request<Product>(`/products/${encodeURIComponent(idOrSlug)}`);
  },
  relatedProducts(productId: number) {
    return request<Product[]>(`/products/${productId}/related`);
  },
  categories() {
    return requestPage<Category>("/categories?limit=100");
  },
  reviews(productId: number, page = 1) {
    return requestPage<Review>(`/products/${productId}/reviews?page=${page}&limit=10`);
  },
  submitReview(productId: number, input: { rating: number; comment?: string }) {
    return request<{ id: number; status: string }>(`/products/${productId}/reviews`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  cart() {
    return request<Cart>("/cart");
  },
  addCartItem(variant_id: number, quantity: number) {
    return request<{ cart_id: number; variant_id: number; quantity: number }>("/cart/items", {
      method: "POST",
      body: JSON.stringify({ variant_id, quantity }),
    });
  },
  updateCartItem(id: number, quantity: number) {
    return request<{ id: number; quantity: number }>(`/cart/items/${id}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    });
  },
  removeCartItem(id: number) {
    return request<void>(`/cart/items/${id}`, { method: "DELETE" });
  },
  login(input: { identifier: string; password: string }) {
    return request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify(input) });
  },
  register(input: { full_name: string; email: string; phone?: string; password: string }) {
    return request<{ user: User }>("/auth/register", { method: "POST", body: JSON.stringify(input) });
  },
  logout() {
    return request<{ logged_out: boolean }>("/auth/logout", { method: "POST" });
  },
  me() {
    return request<{ user: User }>("/auth/me");
  },
  forgotPassword(email: string) {
    return request<{ success: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(input: { email: string; otp: string; new_password: string }) {
    return request<{ success: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  orders() {
    return requestPage<Order>("/orders?limit=100");
  },
  order(id: number, params?: { code?: string; phone?: string }) {
    const query = new URLSearchParams();
    if (params?.code) query.set("code", params.code);
    if (params?.phone) query.set("phone", params.phone);
    const qStr = query.toString();
    return request<Order>(`/orders/${id}${qStr ? `?${qStr}` : ""}`);
  },
  cancelOrder(id: number) {
    return request<{ id: number; status: string }>(`/orders/${id}/cancel`, { method: "PATCH", body: "{}" });
  },
  createOrder(input: {
    payment_method: "COD" | "BANK_TRANSFER";
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    shipping_address_line: string;
    shipping_ward?: string;
    shipping_district?: string;
    shipping_province: string;
    note?: string;
    coupon_code?: string;
    items?: Array<{ variant_id: number; quantity: number }>;
  }) {
    return request<Order>("/orders", { method: "POST", body: JSON.stringify(input) });
  },
  validateCoupon(code: string, subtotal: number) {
    return request<{
      code: string;
      name?: string;
      discount_amount: number;
      discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
      discount_value: number;
    }>("/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code, subtotal }),
    });
  },
  lookupOrder(input: { order_code: string; phone: string }) {
    return request<Order>("/orders/lookup", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  cancelPublicOrder(input: { order_code: string; phone: string }) {
    return request<{ success: boolean; status: string }>("/orders/lookup/cancel", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  createPaypalOrder(orderId: number) {
    return request<{ paypal_order_id: string; usd_amount: string; approval_url?: string }>(`/orders/${orderId}/paypal/create`, {
      method: "POST",
    });
  },
  capturePaypalOrder(orderId: number, paypalOrderId: string) {
    return request<{ success: boolean; status: string }>(`/orders/${orderId}/paypal/capture`, {
      method: "POST",
      body: JSON.stringify({ paypal_order_id: paypalOrderId }),
    });
  },
  simulateSepayPayment(orderId: number) {
    return request<{ success: boolean; message: string; simulated: boolean }>(`/orders/${orderId}/simulate-sepay`, {
      method: "POST",
    });
  },
  videos() {
    return requestPage<Video>("/videos?limit=20");
  },
  socialLinks() {
    return requestPage<SocialLink>("/social-links?limit=20");
  },
  banners() {
    return requestPage<Banner>("/banners?limit=10");
  },
  blogPosts() {
    return requestPage<BlogPost>("/blog/posts?limit=12");
  },
  blogPost(slug: string) {
    return request<BlogPost>(`/blog/posts/${encodeURIComponent(slug)}`);
  },
  storeSettings() {
    return request<StoreSettings>("/settings");
  },
  admin: {
    settings() {
      return request<AdminStoreSettings>("/admin/settings");
    },
    updateSettings(input: AdminStoreSettings) {
      return request<AdminStoreSettings>("/admin/settings", { method: "PUT", body: JSON.stringify(input) });
    },
    dashboardStats() {
      return request<AdminDashboardStats>("/admin/dashboard/stats");
    },
    list(resource: string, params: { page?: number; limit?: number; search?: string; category?: string; sort?: string; status?: string } = {}) {
      return requestPage<AdminRecord>(`/admin/${resource}${queryString(params)}`);
    },
    product(id: number) {
      return request<Product>(`/admin/products/${id}`);
    },
    user(id: number) {
      return request<AdminUserDetail>(`/admin/users/${id}`);
    },
    order(id: number) {
      return request<Order>(`/admin/orders/${id}`);
    },
    create(resource: string, input: AdminRecord) {
      return request<{ id: number }>(`/admin/${resource}`, { method: "POST", body: JSON.stringify(input) });
    },
    update(resource: string, id: number, input: AdminRecord) {
      return request<{ id: number }>(`/admin/${resource}/${id}`, {
        method: resource === "users" ? "PATCH" : "PUT",
        body: JSON.stringify(input),
      });
    },
    remove(resource: string, id: number) {
      return request<{ id: number }>(`/admin/${resource}/${id}`, { method: "DELETE" });
    },
    addVariant(productId: number, input: AdminRecord) {
      return request<{ id: number }>(`/admin/products/${productId}/variants`, { method: "POST", body: JSON.stringify(input) });
    },
    updateVariant(id: number, input: AdminRecord) {
      return request<{ id: number }>(`/admin/variants/${id}`, { method: "PUT", body: JSON.stringify(input) });
    },
    removeVariant(id: number) {
      return request<{ id: number }>(`/admin/variants/${id}`, { method: "DELETE" });
    },
    addImage(productId: number, input: AdminRecord) {
      return request<{ id: number }>(`/admin/products/${productId}/images`, { method: "POST", body: JSON.stringify(input) });
    },
    updateImage(id: number, input: AdminRecord) {
      return request<{ id: number }>(`/admin/product-images/${id}`, { method: "PUT", body: JSON.stringify(input) });
    },
    setPrimaryImage(id: number) {
      return request<{ id: number }>(`/admin/product-images/${id}/primary`, { method: "PATCH", body: "{}" });
    },
    removeImage(id: number) {
      return request<void>(`/admin/product-images/${id}`, { method: "DELETE" });
    },
    setInventory(variantId: number, quantity: number) {
      return request<{ variant_id: number; quantity: number }>(`/admin/inventory/${variantId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
    },
    setOrderStatus(id: number, status: string) {
      return request<{ id: number; status: string }>(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    },
    setReviewStatus(id: number, status: string) {
      return request<{ id: number; status: string }>(`/admin/reviews/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    },
    uploadImage(file: File) {
      const formData = new FormData();
      formData.append("file", file);
      return request<{ url: string; filename: string; size: number }>("/admin/uploads", {
        method: "POST",
        body: formData,
      });
    },
  },
};

export function apiBaseUrl(): string {
  return API_BASE_URL;
}
