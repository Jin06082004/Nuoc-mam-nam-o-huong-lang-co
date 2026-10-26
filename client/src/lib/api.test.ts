// Runtime validation coverage for: empty successful API responses.
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("returns data from a successful JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ success: true, data: { value: 200 } }),
    ));

    await expect(api.request<{ value: number }>("/test")).resolves.toEqual({ value: 200 });
  });

  it("returns an empty product page without treating it as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ success: true, data: [], meta: { page: 1, limit: 12, total: 0 } }),
    ));

    await expect(api.products()).resolves.toMatchObject({ data: [], meta: { total: 0 } });
  });

  it("returns an empty cart without treating it as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ success: true, data: { id: 1, status: "active", items: [] } }),
    ));

    await expect(api.cart()).resolves.toMatchObject({ id: 1, items: [] });
  });

  it("treats a 204 cart deletion response as a successful empty result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.removeCartItem(42)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/cart/items/42",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("requests a paginated admin list with supported filters and credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      success: true,
      data: [],
      meta: { page: 2, limit: 20, total: 0 },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.admin.list("products", { page: 2, limit: 20, search: "nuoc mam", category: "nuoc-mam", sort: "price_asc" }))
      .resolves.toEqual({ data: [], meta: { page: 2, limit: 20, total: 0 } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/admin/products?page=2&limit=20&search=nuoc+mam&category=nuoc-mam&sort=price_asc"),
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });

  it("rejects malformed pagination metadata instead of returning an incomplete page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ success: true, data: [] }),
    ));

    await expect(api.products()).rejects.toMatchObject({
      status: 502,
      message: "Máy chủ trả về dữ liệu phân trang không hợp lệ.",
    });
  });

  it("loads dashboard statistics from the protected admin API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      success: true,
      data: {
        totalOrders: 3,
        pendingOrders: 1,
        revenue: 150000,
        totalProducts: 2,
        totalCustomers: 4,
        lowStockVariants: 1,
        lowStockThreshold: 5,
        recentOrders: [],
        recentReviews: [],
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.admin.dashboardStats()).resolves.toMatchObject({
      totalOrders: 3,
      revenue: 150000,
      lowStockThreshold: 5,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/admin/dashboard/stats",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });

  it("uses the public and protected store-settings endpoints and can cancel an order", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, data: { store_name: "Cửa hàng", facebook_url: null } }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { store_name: "Cửa hàng", customer_cancellation_statuses: ["PENDING"] } }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { id: 4, status: "CANCELLED" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.storeSettings()).resolves.toMatchObject({ store_name: "Cửa hàng", facebook_url: null });
    await expect(api.admin.settings()).resolves.toMatchObject({ customer_cancellation_statuses: ["PENDING"] });
    await expect(api.cancelOrder(4)).resolves.toMatchObject({ id: 4, status: "CANCELLED" });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://localhost:3001/api/settings",
      "http://localhost:3001/api/admin/settings",
      "http://localhost:3001/api/orders/4/cancel",
    ]);
  });

  it("uses the admin product and user detail routes for edit forms", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, data: { id: 5, name: "Product" } }))
      .mockResolvedValueOnce(Response.json({
        success: true,
        data: {
          profile: { id: 9, full_name: "Customer" },
          orders: [{ id: 3, order_code: "ORDER-3" }],
          reviews: [],
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await api.admin.product(5);
    await expect(api.admin.user(9)).resolves.toMatchObject({
      profile: { id: 9, full_name: "Customer" },
      orders: [{ id: 3, order_code: "ORDER-3" }],
      reviews: [],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3001/api/admin/products/5");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:3001/api/admin/users/9");
    expect(fetchMock.mock.calls.every((call) => call[1]?.credentials === "include")).toBe(true);
  });

  it("rejects an unexpected 204 response from a non-delete request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(api.request("/unexpected")).rejects.toMatchObject({ status: 204 });
  });

  it.each([404, 500])("surfaces API errors for HTTP %i responses", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ success: false, message: `HTTP ${status} failure` }, { status }),
    ));

    await expect(api.request("/failure")).rejects.toMatchObject({
      status,
      message: `HTTP ${status} failure`,
    });
  });

  it("surfaces request timeouts explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));

    await expect(api.request("/slow")).rejects.toMatchObject({
      status: 0,
      message: "Máy chủ phản hồi quá lâu. Vui lòng thử lại sau.",
    });
  });

  it("surfaces network failures explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unavailable")));

    await expect(api.request("/offline")).rejects.toMatchObject({
      status: 0,
      message: "Không thể kết nối máy chủ. Vui lòng thử lại sau.",
    });
  });

  it("validates coupons, looks up public orders and submits guest orders", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        success: true,
        data: { coupon_id: "1", code: "GIAM10", discount_amount: 15000, final_total: 135000 },
      }))
      .mockResolvedValueOnce(Response.json({
        success: true,
        data: { id: "10", order_code: "NOMABC123", status: "PENDING", can_cancel: true },
      }))
      .mockResolvedValueOnce(Response.json({
        success: true,
        data: { id: "10", order_code: "NOMABC123", status: "CANCELLED" },
      }))
      .mockResolvedValueOnce(Response.json({
        success: true,
        data: { id: 11, order_code: "NOMXYZ789", customer_phone: "0905123456" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.validateCoupon("GIAM10", 150000)).resolves.toMatchObject({
      code: "GIAM10",
      discount_amount: 15000,
    });
    await expect(api.lookupOrder({ order_code: "NOMABC123", phone: "0905123456" })).resolves.toMatchObject({
      order_code: "NOMABC123",
      can_cancel: true,
    });
    await expect(api.cancelPublicOrder({ order_code: "NOMABC123", phone: "0905123456" })).resolves.toMatchObject({
      status: "CANCELLED",
    });
    await expect(api.createOrder({
      customer_name: "Khách lẻ",
      customer_phone: "0905123456",
      customer_email: "khach@gmail.com",
      shipping_address_line: "123 Đường Nam Ô",
      shipping_province: "Đà Nẵng",
      payment_method: "BANK_TRANSFER",
      coupon_code: "GIAM10",
      items: [{ variant_id: 1, quantity: 2 }],
    })).resolves.toMatchObject({
      id: 11,
      order_code: "NOMXYZ789",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3001/api/coupons/validate");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:3001/api/orders/lookup");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://localhost:3001/api/orders/lookup/cancel");
    expect(fetchMock.mock.calls[3]?.[0]).toBe("http://localhost:3001/api/orders");
  });
});
