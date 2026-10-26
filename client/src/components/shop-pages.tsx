"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { formatDate, orderStatus } from "@/lib/format";
import { clearGuestCart, removeGuestCartItem, updateGuestCartItem } from "@/lib/guest-cart";
import type { BlogPost, Order } from "@/lib/types";
import { useStore } from "./providers";
import { Breadcrumb, Button, EmptyState, ErrorState, Loading, Price, ProductImage } from "./ui";

export function CartPage() {
  const { user, cart, cartLoading, refreshCart, notify } = useStore();
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; name?: string; discount_amount: number } | null>(null);

  useEffect(() => {
    void refreshCart().catch(() => setError("Không thể tải giỏ hàng."));
  }, [refreshCart, retryKey]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("applied-coupon");
      if (stored) {
        setAppliedCoupon(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const items = cart?.items ?? [];
  const total = items.reduce((sum, item) => sum + Number(item.line_total), 0);
  const discountAmount = appliedCoupon ? Math.min(Number(appliedCoupon.discount_amount), total) : 0;
  const finalTotal = Math.max(0, total - discountAmount);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponError("");
    try {
      const result = await api.validateCoupon(code, total);
      setAppliedCoupon(result);
      sessionStorage.setItem("applied-coupon", JSON.stringify(result));
      notify(`Áp dụng mã ưu đãi ${result.code} thành công!`);
    } catch (cause) {
      const msg = cause instanceof ApiError ? cause.message : "Mã ưu đãi không hợp lệ.";
      setCouponError(msg);
      notify(msg, "error");
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
    sessionStorage.removeItem("applied-coupon");
    notify("Đã gỡ bỏ mã giảm giá.");
  }

  async function updateItem(id: number, quantity: number) {
    setBusyItem(id);
    setError("");
    try {
      if (!user) {
        updateGuestCartItem(id, quantity);
        await refreshCart();
      } else {
        await api.updateCartItem(id, quantity);
        await refreshCart();
      }
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Không thể cập nhật giỏ hàng.";
      setError(message);
      notify(message, "error");
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(id: number) {
    setBusyItem(id);
    try {
      if (!user) {
        removeGuestCartItem(id);
        await refreshCart();
        notify("Đã xóa sản phẩm khỏi giỏ.");
      } else {
        await api.removeCartItem(id);
        await refreshCart();
        notify("Đã xóa sản phẩm khỏi giỏ.");
      }
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Không thể xóa sản phẩm.", "error");
    } finally {
      setBusyItem(null);
    }
  }

  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Giỏ hàng" }]} />
      <section className="page-heading"><p className="eyebrow">Mua sắm</p><h1>Giỏ hàng</h1></section>
      {cartLoading && !cart ? <Loading label="Đang tải giỏ hàng…" />
        : error && !cart ? <ErrorState message={error} onRetry={() => setRetryKey((value) => value + 1)} />
          : items.length === 0 ? <EmptyState title="Giỏ hàng đang trống" description="Hãy khám phá danh mục để tìm sản phẩm phù hợp." action={<Button href="/san-pham">Khám phá sản phẩm</Button>} />
            : (
              <>
                {error && <div className="inline-error" role="alert">{error}</div>}
                <div className="cart-layout">
                  <div className="cart-list">
                    {items.map((item) => (
                      <article className="cart-item" key={item.id}>
                        <Link href={`/san-pham/${encodeURIComponent(item.slug)}`} aria-label={`Xem ${item.product_name}`}>
                          <ProductImage alt={item.product_name} className="cart-item__image" />
                        </Link>
                        <div className="cart-item__details">
                          <h2><Link href={`/san-pham/${encodeURIComponent(item.slug)}`}>{item.product_name}</Link></h2>
                          <p>{item.variant_name}</p>
                          <Price value={item.price} />
                          <div className="cart-item__controls">
                            <div className="quantity-control" aria-label={`Số lượng ${item.product_name}`}>
                              <button type="button" aria-label="Giảm số lượng" disabled={busyItem === item.id || item.quantity <= 1} onClick={() => void updateItem(item.id, item.quantity - 1)}>−</button>
                              <span aria-live="polite">{busyItem === item.id ? "…" : item.quantity}</span>
                              <button type="button" aria-label="Tăng số lượng" disabled={busyItem === item.id || item.quantity >= item.available_quantity} onClick={() => void updateItem(item.id, item.quantity + 1)}>＋</button>
                            </div>
                            <button className="text-button text-button--danger" type="button" disabled={busyItem === item.id} onClick={() => void removeItem(item.id)}>Xóa</button>
                          </div>
                        </div>
                        <div className="cart-item__subtotal"><span>Tạm tính</span><Price value={item.line_total} /></div>
                      </article>
                    ))}
                  </div>
                  <aside className="summary-card">
                    <h2>Tóm tắt đơn hàng</h2>
                    <div className="coupon-box">
                      <label className="coupon-box__label" htmlFor="cart-coupon">Mã ưu đãi / Giảm giá</label>
                      <div className="coupon-input-wrap">
                        <input
                          id="cart-coupon"
                          type="text"
                          placeholder="Nhập mã ưu đãi…"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          disabled={couponBusy || Boolean(appliedCoupon)}
                        />
                        {appliedCoupon ? (
                          <button type="button" className="button button--quiet" onClick={removeCoupon}>Gỡ</button>
                        ) : (
                          <button type="button" className="button button--secondary" disabled={couponBusy || !couponInput.trim()} onClick={() => void applyCoupon()}>
                            {couponBusy ? "…" : "Áp dụng"}
                          </button>
                        )}
                      </div>
                      {couponError && <span className="coupon-error-tag">{couponError}</span>}
                      {appliedCoupon && (
                        <span className="coupon-success-tag">
                          ✓ Đã áp dụng mã {appliedCoupon.code} (-{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(discountAmount)})
                        </span>
                      )}
                    </div>
                    <div className="summary-row"><span>Tạm tính</span><Price value={total} /></div>
                    {appliedCoupon && (
                      <div className="summary-row" style={{ color: "var(--color-wood)", fontWeight: 600 }}>
                        <span>Giảm giá ({appliedCoupon.code})</span>
                        <span>-{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(discountAmount)}</span>
                      </div>
                    )}
                    <div className="summary-row"><span>Phí giao hàng</span><span>Tính khi thanh toán</span></div>
                    <div className="summary-row summary-row--total"><strong>Tổng tạm tính</strong><Price value={finalTotal} /></div>
                    <p>Giá và tồn kho sẽ được máy chủ kiểm tra lại khi bạn đặt hàng.</p>
                    <Button href="/thanh-toan" className="button--full">Tiến hành thanh toán</Button>
                    {!user && (
                      <span style={{ fontSize: "0.82rem", color: "var(--color-muted)", textAlign: "center", display: "block", marginTop: "8px" }}>
                        Khách vãng lai có thể đặt hàng ngay hoặc <Link href="/dang-nhap?next=%2Fthanh-toan" style={{ textDecoration: "underline", color: "var(--color-wood)" }}>đăng nhập</Link> để lưu lịch sử.
                      </span>
                    )}
                    <Button href="/san-pham" variant="quiet" className="button--full">Tiếp tục mua hàng</Button>
                  </aside>
                </div>
              </>
            )}
    </main>
  );
}

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2, "Vui lòng nhập họ tên.").max(150),
  customer_phone: z.string().trim().min(7, "Số điện thoại chưa hợp lệ.").max(32),
  customer_email: z.string().trim().email("Email chưa đúng định dạng.").max(255).or(z.literal("")).optional(),
  shipping_province: z.string().trim().min(1, "Vui lòng nhập tỉnh/thành phố.").max(120),
  shipping_district: z.string().trim().max(120),
  shipping_ward: z.string().trim().max(120),
  shipping_address_line: z.string().trim().min(2, "Vui lòng nhập địa chỉ.").max(255),
  note: z.string().max(1000),
  payment_method: z.enum(["COD", "BANK_TRANSFER"]),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

function CopyTextButton({ text, label = "Sao chép" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button type="button" onClick={handleCopy} className="copy-pill-button" title={`Sao chép ${text}`}>
      {copied ? "✓ Đã chép" : label}
    </button>
  );
}

function getVietQrUrl(accountNumber?: string | null, bankName?: string | null, amount?: number | string, orderCode?: string) {
  const acc = encodeURIComponent(accountNumber || "3897126450");
  // ACMEBank is a mock bank in SePay sandbox without a Napas BIN code.
  // We map it to MBBank for the VietQR visual generator so it renders a valid QR image.
  const bank = (!bankName || bankName.toUpperCase().includes("ACME")) ? "MBBank" : encodeURIComponent(bankName);
  const des = encodeURIComponent(orderCode || "HuongLangCo");
  const amt = amount ? encodeURIComponent(String(amount)) : "0";
  return `https://qr.sepay.vn/img?acc=${acc}&bank=${bank}&amount=${amt}&des=${des}`;
}

export function CheckoutPage() {
  const router = useRouter();
  const { user, cart, cartLoading, refreshCart, notify, storeSettings, storeSettingsLoading, storeSettingsError } = useStore();
  const [values, setValues] = useState<CheckoutValues>({
    customer_name: "", customer_phone: "", customer_email: "", shipping_province: "", shipping_district: "", shipping_ward: "",
    shipping_address_line: "", note: "", payment_method: "COD",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutValues, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; name?: string; discount_amount: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    setValues((current) => ({
      ...current,
      customer_name: current.customer_name || user.fullName,
      customer_phone: current.customer_phone || user.phone || "",
      customer_email: current.customer_email || user.email || "",
    }));
  }, [user]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("applied-coupon");
      if (stored) {
        setAppliedCoupon(JSON.parse(stored));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshCart();
  }, [user, refreshCart]);

  const paymentMethods = useMemo(() => [
    ...(storeSettings?.cod_enabled ? ["COD" as const] : []),
    ...(storeSettings?.bank_transfer_enabled ? ["BANK_TRANSFER" as const] : []),
  ], [storeSettings?.bank_transfer_enabled, storeSettings?.cod_enabled]);
  useEffect(() => {
    if (paymentMethods.length && !paymentMethods.includes(values.payment_method)) {
      setValues((current) => ({ ...current, payment_method: paymentMethods[0]! }));
    }
  }, [paymentMethods, values.payment_method]);

  const total = cart?.items.reduce((sum, item) => sum + Number(item.line_total), 0) ?? 0;
  const discountAmount = appliedCoupon ? Math.min(Number(appliedCoupon.discount_amount), total) : 0;
  const subtotalAfterDiscount = Math.max(0, total - discountAmount);
  const fee = storeSettings?.shipping_fee === null || storeSettings?.shipping_fee === undefined
    ? null
    : Number(storeSettings.shipping_fee);
  const freeShipping = Boolean(storeSettings?.free_shipping_enabled)
    && storeSettings?.free_shipping_minimum !== null
    && storeSettings?.free_shipping_minimum !== undefined
    && total >= Number(storeSettings.free_shipping_minimum);
  const estimatedShipping = fee === null ? null : freeShipping ? 0 : fee;
  const finalTotal = fee === null ? subtotalAfterDiscount : subtotalAfterDiscount + (estimatedShipping ?? 0);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponError("");
    try {
      const result = await api.validateCoupon(code, total);
      setAppliedCoupon(result);
      sessionStorage.setItem("applied-coupon", JSON.stringify(result));
      notify(`Áp dụng mã ưu đãi ${result.code} thành công!`);
    } catch (cause) {
      const msg = cause instanceof ApiError ? cause.message : "Mã ưu đãi không hợp lệ.";
      setCouponError(msg);
      notify(msg, "error");
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
    sessionStorage.removeItem("applied-coupon");
    notify("Đã gỡ bỏ mã giảm giá.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = checkoutSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof CheckoutValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CheckoutValues;
        nextErrors[key] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSubmitError("");
    setLoading(true);
    try {
      const { customer_name, customer_phone, customer_email, shipping_province, shipping_district, shipping_ward, shipping_address_line, note, payment_method } = parsed.data;
      const order = await api.createOrder({
        payment_method,
        customer_name,
        customer_phone,
        customer_email: customer_email?.trim() || undefined,
        shipping_province,
        shipping_address_line,
        shipping_district: shipping_district || undefined,
        shipping_ward: shipping_ward || undefined,
        note: note || undefined,
        coupon_code: appliedCoupon?.code,
        items: !user && cart?.items.length
          ? cart.items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }))
          : undefined,
      });
      if (!user) {
        clearGuestCart();
      }
      await refreshCart();
      sessionStorage.removeItem("applied-coupon");
      sessionStorage.setItem("last-order-id", String(order.id));
      sessionStorage.setItem("last-order-code", order.order_code);
      sessionStorage.setItem("last-order-phone", order.customer_phone);
      notify("Đặt hàng thành công.");
      router.push(`/dat-hang-thanh-cong?id=${encodeURIComponent(String(order.id))}&code=${encodeURIComponent(order.order_code)}&phone=${encodeURIComponent(order.customer_phone)}`);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Chưa thể gửi đơn hàng. Vui lòng thử lại.";
      setSubmitError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }

  function field<K extends keyof CheckoutValues>(name: K, value: CheckoutValues[K]) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Giỏ hàng", href: "/gio-hang" }, { label: "Thanh toán" }]} />
      <section className="page-heading"><p className="eyebrow">Hoàn tất đơn hàng</p><h1>Thanh toán</h1></section>
      {cartLoading && !cart ? <Loading label="Đang kiểm tra giỏ hàng…" />
        : !cart?.items.length ? <EmptyState title="Giỏ hàng đang trống" description="Thêm sản phẩm vào giỏ trước khi thanh toán." action={<Button href="/san-pham">Xem sản phẩm</Button>} />
          : (
            <div className="checkout-layout">
                <form className="checkout-form form-card" onSubmit={submit} noValidate>
                  <h2>Thông tin người nhận</h2>
                  <div className="form-grid">
                    <label htmlFor="customer_name">Họ và tên
                      <input id="customer_name" autoComplete="name" value={values.customer_name} onChange={(event) => field("customer_name", event.target.value)} required />
                      {errors.customer_name && <span className="field-error">{errors.customer_name}</span>}
                    </label>
                    <label htmlFor="customer_phone">Số điện thoại
                      <input id="customer_phone" type="tel" autoComplete="tel" value={values.customer_phone} onChange={(event) => field("customer_phone", event.target.value)} required />
                      {errors.customer_phone && <span className="field-error">{errors.customer_phone}</span>}
                    </label>
                    <label htmlFor="customer_email" className="form-grid__wide">
                      Email nhận xác nhận đơn hàng <span className="optional">(không bắt buộc, để nhận mã đơn và hóa đơn điện tử)</span>
                      <input
                        id="customer_email"
                        type="email"
                        autoComplete="email"
                        value={values.customer_email || ""}
                        onChange={(event) => field("customer_email", event.target.value)}
                        placeholder="ví dụ: khachhang@gmail.com"
                      />
                      {errors.customer_email && <span className="field-error">{errors.customer_email}</span>}
                    </label>
                    <label htmlFor="shipping_province">Tỉnh / thành phố
                      <input id="shipping_province" autoComplete="address-level1" value={values.shipping_province} onChange={(event) => field("shipping_province", event.target.value)} required />
                      {errors.shipping_province && <span className="field-error">{errors.shipping_province}</span>}
                    </label>
                    <label htmlFor="shipping_district">Quận / huyện <span className="optional">(không bắt buộc)</span>
                      <input id="shipping_district" autoComplete="address-level2" value={values.shipping_district} onChange={(event) => field("shipping_district", event.target.value)} />
                    </label>
                    <label htmlFor="shipping_ward">Phường / xã <span className="optional">(không bắt buộc)</span>
                      <input id="shipping_ward" autoComplete="address-level3" value={values.shipping_ward} onChange={(event) => field("shipping_ward", event.target.value)} />
                    </label>
                    <label htmlFor="shipping_address_line" className="form-grid__wide">Địa chỉ cụ thể
                      <input id="shipping_address_line" autoComplete="street-address" value={values.shipping_address_line} onChange={(event) => field("shipping_address_line", event.target.value)} required />
                      {errors.shipping_address_line && <span className="field-error">{errors.shipping_address_line}</span>}
                    </label>
                    <label htmlFor="note" className="form-grid__wide">Ghi chú <span className="optional">(không bắt buộc)</span>
                      <textarea id="note" rows={3} value={values.note} onChange={(event) => field("note", event.target.value)} />
                      {errors.note && <span className="field-error">{errors.note}</span>}
                    </label>
                  </div>
                  <fieldset className="payment-options">
                    <legend>Phương thức thanh toán</legend>
                    {storeSettingsLoading ? (
                      <p>Đang tải phương thức thanh toán…</p>
                    ) : paymentMethods.length === 0 ? (
                      <p>Chưa có phương thức thanh toán khả dụng. Vui lòng liên hệ cửa hàng sau khi thông tin được cấu hình.</p>
                    ) : (
                      <div className="payment-methods-grid">
                        {storeSettings?.cod_enabled && (
                          <div
                            className={`payment-method-card ${values.payment_method === "COD" ? "is-selected" : ""}`}
                            onClick={() => field("payment_method", "COD")}
                          >
                            <div className="payment-method-header">
                              <input
                                id="payment_cod"
                                type="radio"
                                name="payment_method"
                                value="COD"
                                checked={values.payment_method === "COD"}
                                onChange={() => field("payment_method", "COD")}
                                className="payment-method-radio"
                              />
                              <label htmlFor="payment_cod" className="payment-method-title">
                                Thanh toán khi nhận hàng (COD)
                              </label>
                            </div>
                            <p className="payment-method-desc">
                              Thanh toán tiền mặt cho nhân viên giao hàng sau khi nhận và kiểm tra kiện hàng nước mắm.
                            </p>
                          </div>
                        )}

                        {storeSettings?.bank_transfer_enabled && (
                          <div
                            className={`payment-method-card ${values.payment_method === "BANK_TRANSFER" ? "is-selected" : ""}`}
                            onClick={() => field("payment_method", "BANK_TRANSFER")}
                          >
                            <div className="payment-method-header">
                              <input
                                id="payment_bank"
                                type="radio"
                                name="payment_method"
                                value="BANK_TRANSFER"
                                checked={values.payment_method === "BANK_TRANSFER"}
                                onChange={() => field("payment_method", "BANK_TRANSFER")}
                                className="payment-method-radio"
                              />
                              <label htmlFor="payment_bank" className="payment-method-title">
                                <span>Chuyển khoản quét mã VietQR</span>
                                <span className="payment-badge payment-badge--instant">⚡ Tự động xác nhận 24/7</span>
                              </label>
                            </div>
                            <p className="payment-method-desc">
                              Quét mã VietQR bằng bất kỳ App Ngân hàng (MBBank, Vietcombank, Techcombank, BIDV, VPBank,...) hoặc Ví điện tử (MoMo, ZaloPay).
                            </p>

                            {values.payment_method === "BANK_TRANSFER" && (
                              <div className="qr-checkout-preview" onClick={(e) => e.stopPropagation()}>
                                <div className="qr-image-wrapper">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={getVietQrUrl(storeSettings.bank_account_number, storeSettings.bank_name, total + (estimatedShipping ?? 0))}
                                    alt="Mã VietQR mẫu thanh toán"
                                    width={140}
                                    height={140}
                                    style={{ display: "block", margin: "0 auto" }}
                                  />
                                  <span style={{ fontSize: "0.72rem", color: "var(--color-muted)", display: "block", marginTop: "4px" }}>
                                    Quét bằng App Ngân hàng
                                  </span>
                                </div>
                                <div className="qr-info-list">
                                  <div>
                                    Ngân hàng: <strong>{storeSettings.bank_name || "ACMEBank"}</strong>
                                  </div>
                                  <div>
                                    Số tài khoản: <strong>{storeSettings.bank_account_number || "3897126450"}</strong>
                                    <CopyTextButton text={storeSettings.bank_account_number || "3897126450"} />
                                  </div>
                                  {storeSettings.bank_branch && (
                                    <div style={{ fontSize: "0.8rem", color: "var(--color-wood)" }}>
                                      {storeSettings.bank_branch}
                                      <CopyTextButton text="SBPAY9735061428" label="Chép TK ảo" />
                                    </div>
                                  )}
                                  <div>
                                    Chủ tài khoản: <strong>{storeSettings.bank_account_holder || "NGUYEN NGUYEN PHUC"}</strong>
                                  </div>
                                  <div>
                                    Số tiền: <strong><Price value={total + (estimatedShipping ?? 0)} /></strong>
                                  </div>
                                  <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--color-muted)" }}>
                                    💡 <em>Sau khi bấm <strong>Đặt hàng</strong>, mã QR gắn mã đơn của bạn sẽ hiển thị để hệ thống SePay tự động đối soát và kích hoạt đơn hàng trong 1-3 phút.</em>
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </fieldset>
                  {storeSettingsError && <div className="inline-error" role="alert">Không thể tải cài đặt giao hàng và thanh toán. Vui lòng tải lại trang trước khi đặt hàng.</div>}
                  {submitError && <div className="inline-error" role="alert">{submitError}</div>}
                  <Button type="submit" disabled={loading || storeSettingsLoading || !storeSettings || fee === null || paymentMethods.length === 0}>{loading ? "Đang gửi đơn…" : "Đặt hàng"}</Button>
                </form>
                <aside className="summary-card">
                  <h2>Đơn hàng của bạn</h2>
                  {cart.items.map((item) => <div className="summary-row" key={item.id}><span>{item.product_name} · {item.variant_name} × {item.quantity}</span><Price value={item.line_total} /></div>)}

                  <div className="coupon-box" style={{ margin: "1rem 0" }}>
                    <label className="coupon-box__label" htmlFor="checkout-coupon">Mã ưu đãi / Giảm giá</label>
                    <div className="coupon-input-wrap">
                      <input
                        id="checkout-coupon"
                        type="text"
                        placeholder="Nhập mã ưu đãi…"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        disabled={couponBusy || Boolean(appliedCoupon)}
                      />
                      {appliedCoupon ? (
                        <button type="button" className="button button--quiet" onClick={removeCoupon}>Gỡ</button>
                      ) : (
                        <button type="button" className="button button--secondary" disabled={couponBusy || !couponInput.trim()} onClick={() => void applyCoupon()}>
                          {couponBusy ? "…" : "Áp dụng"}
                        </button>
                      )}
                    </div>
                    {couponError && <span className="coupon-error-tag">{couponError}</span>}
                    {appliedCoupon && (
                      <span className="coupon-success-tag">
                        ✓ Đã áp dụng mã {appliedCoupon.code} (-{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(discountAmount)})
                      </span>
                    )}
                  </div>

                  <div className="summary-row"><span>Tạm tính</span><Price value={total} /></div>
                  {appliedCoupon && (
                    <div className="summary-row" style={{ color: "var(--color-wood)", fontWeight: 600 }}>
                      <span>Giảm giá ({appliedCoupon.code})</span>
                      <span>-{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(discountAmount)}</span>
                    </div>
                  )}
                  <div className="summary-row"><span>Phí giao hàng</span>{estimatedShipping === null ? <span>Chưa cấu hình</span> : <Price value={estimatedShipping} />}</div>
                  {freeShipping && <p>Đơn hàng đạt mức miễn phí vận chuyển.</p>}
                  <div className="summary-row summary-row--total"><strong>Tổng thanh toán</strong>{estimatedShipping === null ? <span>Chưa xác định</span> : <Price value={finalTotal} />}</div>
                  <p>Giá, khuyến mãi, phí vận chuyển và tồn kho được máy chủ xác thực khi đặt hàng.</p>
                </aside>
              </div>
            )}
    </main>
  );
}

export function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const { user, storeSettings, notify } = useStore();
  const id = Number(searchParams.get("id"));
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const stored = sessionStorage.getItem("last-order-id");
    const storedCode = sessionStorage.getItem("last-order-code");
    const storedPhone = sessionStorage.getItem("last-order-phone");
    const orderId = Number.isInteger(id) && id > 0 ? id : Number(stored);
    const code = searchParams.get("code") || storedCode || undefined;
    const phone = searchParams.get("phone") || storedPhone || undefined;
    if (!orderId) {
      setError("Không tìm thấy thông tin đơn hàng gần đây.");
      setLoading(false);
      return;
    }
    let active = true;
    void api.order(orderId, { code, phone }).then((result) => {
      if (active) setOrder(result);
    }).catch((cause) => {
      if (active) setError(cause instanceof ApiError ? cause.message : "Không thể tải thông tin đơn hàng.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, searchParams]);

  return (
    <main className="page-shell container">
      <section className="success-card">
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">Cảm ơn bạn</p>
        <h1>Đơn hàng đã được tiếp nhận</h1>
        {loading ? <Loading label="Đang tải thông tin đơn hàng…" />
          : error ? <p className="form-note">{error}</p>
            : order && (
              <div className="success-card__details">
                <p>Mã đơn hàng <strong>{order.order_code}</strong></p>
                <p>Trạng thái <strong>{orderStatus(order.status)}</strong></p>
                <p>Tổng tiền <strong><Price value={order.total_amount} /></strong></p>
                <p>Thanh toán <strong>{order.payments?.[0]?.payment_method === "COD" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản VietQR (Napas 247)"} · {order.status === "CONFIRMED" ? "Đã thanh toán" : "Chờ xác nhận"}</strong></p>
                {order.payments?.[0]?.payment_method === "BANK_TRANSFER" && (
                  <div className="bank-transfer-details" style={{ marginTop: "1.5rem", padding: "1.25rem", background: "var(--color-card)", borderRadius: "8px", border: "1px solid var(--color-line)", textAlign: "left" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
                      <div style={{ textAlign: "center", background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getVietQrUrl(storeSettings?.bank_account_number, storeSettings?.bank_name, order.total_amount, order.order_code)}
                          alt={`Mã VietQR thanh toán đơn hàng ${order.order_code}`}
                          width={180}
                          height={180}
                          style={{ display: "block", margin: "0 auto" }}
                        />
                        <span style={{ fontSize: "0.75rem", color: "#666", display: "block", marginTop: "6px", fontWeight: 600 }}>Quét mã VietQR qua App Ngân hàng</span>
                      </div>
                      <div style={{ flex: "1 1 280px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "1.05rem", color: "var(--color-wood)" }}>
                            Thông tin chuyển khoản (SePay Sandbox)
                          </strong>
                          <span className="payment-badge payment-badge--instant">⚡ Tự động xác nhận</span>
                        </div>
                        <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>Ngân hàng: <strong>{storeSettings?.bank_name || "ACMEBank"}</strong></p>
                        <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>
                          Số tài khoản: <strong>{storeSettings?.bank_account_number || "3897126450"}</strong>
                          <CopyTextButton text={storeSettings?.bank_account_number || "3897126450"} />
                        </p>
                        {storeSettings?.bank_branch && (
                          <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "var(--color-wood)" }}>
                            {storeSettings.bank_branch}
                            <CopyTextButton text="SBPAY9735061428" label="Chép TK ảo" />
                          </p>
                        )}
                        <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>Chủ tài khoản: <strong>{storeSettings?.bank_account_holder || "NGUYEN NGUYEN PHUC"}</strong></p>
                        <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>
                          Số tiền: <strong>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(order.total_amount))}</strong>
                          <CopyTextButton text={String(order.total_amount)} label="Sao chép tiền" />
                        </p>
                        <div style={{ margin: "8px 0", fontSize: "0.9rem", background: "#FAF8F4", padding: "8px 12px", borderRadius: "6px", border: "1px dashed var(--color-gold)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                          <div>
                            Nội dung CK: <strong style={{ color: "var(--color-wood)", fontSize: "1.05rem" }}>{order.order_code}</strong>
                          </div>
                          <CopyTextButton text={order.order_code} label="Sao chép nội dung" />
                        </div>
                        {order.status !== "CONFIRMED" && (
                          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #ddd" }}>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await api.simulateSepayPayment(order.id);
                                  const refreshed = await api.order(order.id, {
                                    code: order.order_code,
                                    phone: order.customer_phone,
                                  });
                                  setOrder(refreshed);
                                  notify("Đã giả lập webhook SePay thành công! Đơn hàng đã chuyển sang trạng thái ĐÃ XÁC NHẬN.", "success");
                                } catch {
                                  notify("Không thể kích hoạt giả lập thanh toán.", "error");
                                }
                              }}
                              className="copy-pill-button"
                              style={{ padding: "6px 14px", fontSize: "0.82rem", background: "#E8F5E9", color: "#1B5E20", borderColor: "#A5D6A7" }}
                            >
                              🧪 Giả lập thanh toán thành công (SePay Webhook)
                            </button>
                          </div>
                        )}
                        <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "6px 0 0" }}>
                          * Hệ thống sẽ tự động xác nhận và chuyển đơn hàng sang trạng thái ĐÃ XÁC NHẬN trong vòng 1–3 phút sau khi chuyển khoản thành công.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
        <div className="success-card__actions">
          {order && (
            user ? (
              <Button href={`/tai-khoan/don-hang/${order.id}`}>Xem chi tiết đơn hàng</Button>
            ) : (
              <Button href={`/tra-cuu-don-hang?code=${encodeURIComponent(order.order_code)}&phone=${encodeURIComponent(order.customer_phone)}`}>
                Theo dõi hành trình đơn hàng
              </Button>
            )
          )}
          <Button href="/san-pham" variant="secondary">Tiếp tục mua sắm</Button>
        </div>
      </section>
    </main>
  );
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser, notify } = useStore();
  const [values, setValues] = useState({ full_name: "", email: "", phone: "", password: "", confirm_password: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const next = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (user) router.replace(next || "/tai-khoan");
  }, [user, router, next]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const schema = mode === "register"
      ? z.object({
        full_name: z.string().trim().min(2, "Họ tên cần ít nhất 2 ký tự.").max(150),
        email: z.string().trim().email("Email chưa hợp lệ.").max(254),
        phone: z.string().trim().min(7, "Số điện thoại chưa hợp lệ.").max(32),
        password: z.string().min(10, "Mật khẩu cần ít nhất 10 ký tự.").max(128),
        confirm_password: z.string(),
      }).refine((value) => value.password === value.confirm_password, { path: ["confirm_password"], message: "Mật khẩu xác nhận không khớp." })
      : z.object({
        email: z.string().trim().min(1, "Vui lòng nhập email hoặc số điện thoại."),
        password: z.string().min(1, "Vui lòng nhập mật khẩu."),
      });
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setErrors([]);
    setBusy(true);
    try {
      if (mode === "login") {
        await api.login({ identifier: values.email, password: values.password });
      } else {
        await api.register({ full_name: values.full_name.trim(), email: values.email.trim(), phone: values.phone.trim(), password: values.password });
      }
      await refreshUser();
      notify(mode === "login" ? "Đăng nhập thành công." : "Tạo tài khoản thành công.");
      router.replace(next || "/tai-khoan");
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Không thể xác thực tài khoản.";
      setErrors([message]);
    } finally {
      setBusy(false);
    }
  }

  function update(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <main className="auth-page container">
      <form className="auth-card form-card" onSubmit={submit} noValidate>
        <p className="eyebrow">{mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản khách hàng"}</p>
        <h1>{mode === "login" ? "Đăng nhập" : "Đăng ký"}</h1>
        <p>{mode === "login" ? "Đăng nhập để quản lý giỏ hàng và đơn hàng." : "Tạo tài khoản để mua sắm và theo dõi đơn hàng."}</p>
        {mode === "register" && (
          <>
            <label htmlFor="full_name">Họ và tên</label>
            <input id="full_name" autoComplete="name" required value={values.full_name} onChange={(event) => update("full_name", event.target.value)} />
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={values.email} onChange={(event) => update("email", event.target.value)} />
            <label htmlFor="phone">Số điện thoại <span className="optional">(không bắt buộc)</span></label>
            <input id="phone" type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} />
          </>
        )}
        {mode === "login" && (
          <>
            <label htmlFor="login-identifier">Email hoặc số điện thoại</label>
            <input id="login-identifier" autoComplete="username" required value={values.email} onChange={(event) => update("email", event.target.value)} />
          </>
        )}
        <label htmlFor="password">Mật khẩu</label>
        <div className="password-field">
          <input id="password" type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={values.password} onChange={(event) => update("password", event.target.value)} />
          <button type="button" className="text-button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{visible ? "Ẩn" : "Hiện"}</button>
        </div>
        {mode === "register" && (
          <>
            <label htmlFor="confirm_password">Xác nhận mật khẩu</label>
            <input id="confirm_password" type={visible ? "text" : "password"} autoComplete="new-password" required value={values.confirm_password} onChange={(event) => update("confirm_password", event.target.value)} />
          </>
        )}
        {errors.length > 0 && <div className="inline-error" role="alert"><ul>{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}
        <Button type="submit" disabled={busy} className="button--full">{busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</Button>
        <p className="auth-card__switch">
          {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <Link href={mode === "login" ? "/dang-ky" : "/dang-nhap"}>{mode === "login" ? "Đăng ký" : "Đăng nhập"}</Link>
        </p>
      </form>
    </main>
  );
}

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export function AccountPage() {
  const { user, authLoading, setUser, notify } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/dang-nhap?next=${encodeURIComponent("/tai-khoan")}`);
  }, [authLoading, user, router]);

  async function logout() {
    setBusy(true);
    try {
      await api.logout();
      setUser(null);
      notify("Bạn đã đăng xuất.");
      router.replace("/");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Không thể đăng xuất.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) return <main className="page-shell container"><Loading label="Đang tải tài khoản…" /></main>;
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Tài khoản" }]} />
      <section className="page-heading"><p className="eyebrow">Khu vực khách hàng</p><h1>Tài khoản của bạn</h1></section>
      <div className="account-layout">
        <nav className="account-nav" aria-label="Điều hướng tài khoản">
          <Link className="is-active" href="/tai-khoan">Tổng quan</Link>
          <Link href="/tai-khoan/don-hang">Đơn hàng của tôi</Link>
          <button type="button" onClick={logout} disabled={busy}>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</button>
        </nav>
        <section className="account-card">
          <h2>Thông tin tài khoản</h2>
          <dl className="account-details">
            <div><dt>Họ và tên</dt><dd>{user.fullName}</dd></div>
            <div><dt>Email</dt><dd>{user.email || "Chưa cung cấp"}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{user.phone || "Chưa cung cấp"}</dd></div>
          </dl>
          <Button href="/tai-khoan/don-hang" variant="secondary">Xem đơn hàng</Button>
        </section>
      </div>
    </main>
  );
}

export function OrderHistoryPage() {
  const { user, authLoading } = useStore();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      setOrders((await api.orders()).data);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải danh sách đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    if (!authLoading && !user) router.replace(`/dang-nhap?next=${encodeURIComponent("/tai-khoan/don-hang")}`);
    if (user) void load();
  }, [authLoading, user, router, load, retry]);

  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Tài khoản", href: "/tai-khoan" }, { label: "Đơn hàng" }]} />
      <section className="page-heading"><p className="eyebrow">Lịch sử mua hàng</p><h1>Đơn hàng của tôi</h1></section>
      {authLoading || !user || loading ? <Loading label="Đang tải đơn hàng…" />
        : error ? <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
          : orders.length ? <div className="order-list">{orders.map((order) => (
            <Link className="order-card" href={`/tai-khoan/don-hang/${order.id}`} key={order.id}>
              <div><span className="order-card__label">Mã đơn</span><strong>{order.order_code}</strong></div>
              <div><span className="order-card__label">Ngày đặt</span><span>{formatDate(order.created_at)}</span></div>
              <div><span className="order-card__label">Trạng thái</span><span className={`status-pill status-pill--${order.status.toLowerCase()}`}>{orderStatus(order.status)}</span></div>
              <div><span className="order-card__label">Tổng tiền</span><Price value={order.total_amount} /></div>
              <span className="order-card__arrow" aria-hidden="true">→</span>
            </Link>
          ))}</div>
            : <EmptyState title="Chưa có đơn hàng" description="Các đơn hàng bạn đặt sẽ hiển thị tại đây." action={<Button href="/san-pham">Khám phá sản phẩm</Button>} />}
    </main>
  );
}

export function OrderDetailPage({ orderId }: { orderId: number }) {
  const { user, authLoading, storeSettings, notify } = useStore();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [canceling, setCanceling] = useState(false);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/dang-nhap?next=${encodeURIComponent(`/tai-khoan/don-hang/${orderId}`)}`);
      return;
    }
    let active = true;
    void api.order(orderId).then((result) => {
      if (active) setOrder(result);
    }).catch((cause) => {
      if (active) setError(cause instanceof ApiError ? cause.message : "Không thể tải đơn hàng.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, user, router, orderId]);

  async function cancelOrder() {
    if (!order?.can_cancel || !window.confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
    setCanceling(true);
    setNotice("");
    try {
      await api.cancelOrder(orderId);
      setNotice("Đã hủy đơn hàng.");
      try {
        setOrder(await api.order(orderId));
      } catch {
        setNotice("Đơn hàng đã được hủy nhưng chưa tải lại được thông tin. Vui lòng làm mới trang.");
      }
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Không thể hủy đơn hàng.";
      setNotice(message);
    } finally {
      setCanceling(false);
    }
  }

  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Tài khoản", href: "/tai-khoan" }, { label: "Đơn hàng", href: "/tai-khoan/don-hang" }, { label: "Chi tiết đơn" }]} />
      {authLoading || loading ? <Loading label="Đang tải chi tiết đơn hàng…" />
        : error ? <ErrorState message={error} />
          : order && (
            <>
              <section className="page-heading page-heading--order">
                <div><p className="eyebrow">Chi tiết đơn hàng</p><h1>{order.order_code}</h1></div>
                <span className={`status-pill status-pill--${order.status.toLowerCase()}`}>{orderStatus(order.status)}</span>
              </section>
              <div className="order-detail-layout">
                <section className="account-card">
                  <h2>Sản phẩm đã đặt</h2>
                  <div className="order-lines">{order.items?.map((item, index) => (
                    <div className="order-line" key={`${item.sku}-${index}`}>
                      <div><strong>{item.product_name}</strong><span>{item.variant_name} · SKU {item.sku} · SL {item.quantity}</span></div>
                      <Price value={item.subtotal} />
                    </div>
                  ))}</div>
                  <div className="summary-row"><span>Tạm tính</span><Price value={order.subtotal} /></div>
                  <div className="summary-row"><span>Phí giao hàng</span><Price value={order.shipping_fee} /></div>
                  <div className="summary-row"><span>Giảm giá</span><Price value={order.discount_amount} /></div>
                  <div className="summary-row summary-row--total"><strong>Tổng cộng</strong><Price value={order.total_amount} /></div>
                </section>
                <aside className="account-card">
                  <h2>Thông tin giao hàng</h2>
                  <p><strong>{order.customer_name}</strong><br />{order.customer_phone}</p>
                  <p>{order.shipping_address_line}<br />{[order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(", ")}</p>
                  {order.note && <p>Ghi chú: {order.note}</p>}
                  <h3>Thanh toán</h3>
                  {order.payments?.map((payment, index) => <p key={`${payment.payment_method}-${index}`}>{payment.payment_method === "COD" ? "Thanh toán khi nhận hàng" : "Chuyển khoản VietQR"} · {payment.payment_status === "PENDING" ? "Chờ xác nhận" : payment.payment_status}</p>)}
                  {order.payments?.some((payment) => payment.payment_method === "BANK_TRANSFER") && storeSettings?.bank_transfer_enabled && (
                    <div className="bank-transfer-details" style={{ marginTop: "1rem", padding: "1rem", background: "var(--color-card)", borderRadius: "8px", border: "1px solid var(--color-line)" }}>
                      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                        {order.status !== "CONFIRMED" && order.status !== "DELIVERED" && (
                          <div style={{ textAlign: "center", background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #ddd" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getVietQrUrl(storeSettings.bank_account_number, storeSettings.bank_name, order.total_amount, order.order_code)}
                              alt={`Mã VietQR ${order.order_code}`}
                              width={120}
                              height={120}
                              style={{ display: "block" }}
                            />
                            <span style={{ fontSize: "0.7rem", color: "#666", display: "block", marginTop: "2px" }}>Quét mã QR</span>
                          </div>
                        )}
                        <div style={{ flex: "1 1 200px" }}>
                          <strong style={{ display: "block", marginBottom: "4px" }}>Thông tin nhận chuyển khoản (SePay Sandbox)</strong>
                          <p style={{ margin: "2px 0", fontSize: "0.85rem" }}>{storeSettings.bank_name} · <strong>{storeSettings.bank_account_number}</strong> <CopyTextButton text={storeSettings.bank_account_number || "3897126450"} /></p>
                          {storeSettings.bank_branch && (
                            <p style={{ margin: "2px 0", fontSize: "0.8rem", color: "var(--color-wood)" }}>
                              {storeSettings.bank_branch}
                              <CopyTextButton text="SBPAY9735061428" label="Chép TK ảo" />
                            </p>
                          )}
                          <p style={{ margin: "2px 0", fontSize: "0.85rem" }}>{storeSettings.bank_account_holder}</p>
                          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", background: "#FAF8F4", padding: "4px 8px", borderRadius: "4px", border: "1px dashed var(--color-gold)", display: "inline-block" }}>
                            Nội dung: <strong>{order.order_code}</strong> <CopyTextButton text={order.order_code} label="Sao chép" />
                          </p>
                          {order.status !== "CONFIRMED" && (
                            <div style={{ marginTop: "8px" }}>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await api.simulateSepayPayment(order.id);
                                    window.location.reload();
                                  } catch {
                                    notify("Không thể kích hoạt giả lập thanh toán.", "error");
                                  }
                                }}
                                className="copy-pill-button"
                                style={{ padding: "4px 10px", fontSize: "0.78rem", background: "#E8F5E9", color: "#1B5E20", borderColor: "#A5D6A7" }}
                              >
                                🧪 Giả lập thanh toán SePay thành công
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="order-card__label">Đặt ngày {formatDate(order.created_at)}</p>
                  {notice && <p className="form-note" role="status">{notice}</p>}
                  {order.can_cancel && <Button type="button" variant="quiet" disabled={canceling} onClick={() => void cancelOrder()}>{canceling ? "Đang hủy…" : "Hủy đơn hàng"}</Button>}
                </aside>
              </div>
            </>
          )}
    </main>
  );
}

export function AboutPage() {
  const { storeSettings } = useStore();
  const storeName = storeSettings?.store_name.trim() || "Nước mắm Nam Ô Hương Làng Cổ";
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Về thương hiệu" }]} />
      <section className="editorial-hero">
        <p className="eyebrow">{storeName}</p>
        <h1>Giữ hồn giọt ngọc Nam Ô — Hành trình gìn giữ di sản 400 năm</h1>
        <p>Thương hiệu Nước mắm Nam Ô — Hương Làng Cổ thuộc Công ty TNHH Mắm Hồng Hương, được dẫn dắt bởi nghệ nhân Bùi Thanh Phú cùng tâm huyết khôi phục và tôn vinh Di sản văn hóa phi vật thể Quốc gia.</p>
      </section>

      <section className="editorial-content">
        <h2>1. Làng chài cổ Nam Ô và lịch sử hơn 4 thế kỷ</h2>
        <p>Nằm nép mình dưới chân đèo Hải Vân hùng vĩ, bên bờ vịnh Đà Nẵng, làng chài Nam Ô đã có hơn 400 năm lịch sử hình thành và phát triển. Nơi đây từng là vùng đất nổi danh khắp xứ Đàng Trong với nghề làm nước mắm nhĩ tiến vua, mang phong vị mặn mòi, nồng đậm đặc trưng của vùng duyên hải miền Trung.</p>

        <h2>2. Nghệ nhân Bùi Thanh Phú và khát vọng chấn hưng làng nghề</h2>
        <p>Sinh ra và lớn lên trong gia đình 4 đời gắn bó với nghề làm mắm, anh Bùi Thanh Phú (người sáng lập thương hiệu Hương Làng Cổ, Giám đốc Công ty TNHH Mắm Hồng Hương) từng tốt nghiệp Thạc sĩ Công nghệ Thông tin và là giảng viên. Đứng trước nguy cơ mai một của làng nghề truyền thống trước làn sóng nước mắm công nghiệp, anh đã quyết định rẽ hướng, trở về quê hương tiếp nối cơ nghiệp của cha ông.</p>
        <p>Bằng sự nhạy bén, tư duy chuẩn hóa và tình yêu tha thiết với di sản quê hương, anh Bùi Thanh Phú đã được vinh danh là một trong những <strong>Nông dân Việt Nam xuất sắc</strong>, đưa giọt mắm Nam Ô vươn xa khắp mọi miền đất nước.</p>

        <h2>3. Tinh hoa nguyên liệu và bí quyết ủ lu sành</h2>
        <p>Nước mắm Nam Ô Hương Làng Cổ tuân thủ nghiêm ngặt phương pháp chượp mắm cổ truyền của các bậc tiền nhân:</p>
        <ul>
          <li><strong>Cá cơm than tươi ngon:</strong> Chỉ sử dụng cá cơm than được đánh bắt đúng vụ cá béo nhất (tháng Ba âm lịch) tại vùng biển Nam Ô — Hải Vân, mình dày, lấp lánh vảy bạc.</li>
          <li><strong>Muối Sa Huỳnh trữ kho:</strong> Muối biển tinh khiết từ vựa muối Sa Huỳnh (Quảng Ngãi), được lưu trữ trong kho từ 1 đến 2 năm để loại bỏ triệt để vị đắng, chát của muối non, chỉ giữ lại vị mặn thanh khiết.</li>
          <li><strong>Tỷ lệ vàng 3 cá : 1 muối:</strong> Hỗn hợp cá và muối được đảo đều rồi ủ chượp tự nhiên trong các chum, vại, lu sành đất nung dày dặn dưới nắng gió suốt 12 đến 18 tháng ròng.</li>
          <li><strong>Chắt lọc thủ công:</strong> Từng giọt mắm nhĩ màu hổ phách cánh gián được lọc từ từ qua phễu tre đan thủ công lót vải mịn, cho ra dòng nước mắm nguyên chất thơm lừng, sóng sánh với hậu vị ngọt béo tự nhiên của đạm cá biển.</li>
        </ul>

        <h2>4. Chuẩn hóa OCOP 4 sao và chứng nhận quốc tế HACCP</h2>
        <p>Không chỉ gìn giữ bí quyết gia truyền, cơ sở Hương Làng Cổ tiên phong áp dụng hệ thống quản lý an toàn thực phẩm theo tiêu chuẩn quốc tế <strong>HACCP</strong> và tự hào được UBND TP. Đà Nẵng công nhận đạt chuẩn <strong>OCOP 4 sao</strong>. Sản phẩm cam kết 100% nguyên chất, không chất bảo quản, không phẩm màu, không hương liệu nhân tạo.</p>

        <h2>5. Điểm đến du lịch trải nghiệm di sản Nam Ô</h2>
        <p>Tọa lạc tại Tổ 97 (Nam Ô 2), Kiệt 884/74/4 Nguyễn Lương Bằng, xưởng mắm Hương Làng Cổ luôn mở rộng cửa đón chào du khách, học sinh, sinh viên và các đoàn trải nghiệm văn hóa đến trực tiếp tham quan hàng trăm chiếc lu sành cổ kính, tự tay học cách trộn cá muối và thưởng thức giọt mắm nhĩ tinh túy ngay tại xưởng.</p>

        <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
          <Button href="/san-pham">Khám phá sản phẩm OCOP</Button>
          <Button href="/lien-he" variant="secondary">Liên hệ & Thăm xưởng</Button>
        </div>
      </section>
    </main>
  );
}

export function BlogListingPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void api.blogPosts().then((result) => {
      if (active) setPosts(result.data);
    }).catch((cause) => {
      if (active) setError(cause instanceof ApiError ? cause.message : "Không thể tải bài viết.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Bài viết" }]} />
      <section className="page-heading"><p className="eyebrow">Kiến thức và câu chuyện</p><h1>Bài viết</h1><p>Nội dung được đăng tải bởi chủ thương hiệu.</p></section>
      {loading ? <Loading label="Đang tải bài viết…" />
        : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setRetry((value) => value + 1); }} />
          : posts.length ? <div className="blog-grid">{posts.map((post) => (
            <article className="blog-card" key={post.id}>
              <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="blog-card__image">
                <ProductImage src={post.thumbnail_url} alt={post.title} />
              </Link>
              <div><time dateTime={post.published_at ?? undefined}>{post.published_at ? formatDate(post.published_at) : ""}</time>
                <h2><Link href={`/blog/${encodeURIComponent(post.slug)}`}>{post.title}</Link></h2>
                {post.excerpt && <p>{post.excerpt}</p>}
              </div>
            </article>
          ))}</div>
            : <EmptyState title="Chưa có bài viết" description="Bài viết sẽ hiển thị sau khi được chủ thương hiệu đăng tải." action={<Button href="/san-pham" variant="secondary">Xem sản phẩm</Button>} />}
    </main>
  );
}

export function BlogPostPage({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api.blogPost(slug).then((result) => {
      if (active) setPost(result);
    }).catch((cause) => {
      if (active) setError(cause instanceof ApiError ? cause.message : "Không thể tải bài viết.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Bài viết", href: "/blog" }, { label: post?.title ?? "Bài viết" }]} />
      {loading ? <Loading label="Đang tải bài viết…" />
        : error ? <ErrorState message={error} />
          : post && (
            <article className="blog-post">
              <header><p className="eyebrow">Nội dung thương hiệu</p><h1>{post.title}</h1>{post.published_at && <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>}</header>
              {post.thumbnail_url && <ProductImage src={post.thumbnail_url} alt={post.title} className="blog-post__image" />}
              {post.excerpt && <p className="blog-post__excerpt">{post.excerpt}</p>}
              <div className="blog-post__content">{post.content}</div>
            </article>
          )}
    </main>
  );
}

export function NotFoundContent() {
  return (
    <main className="page-shell container">
      <EmptyState title="Không tìm thấy trang" description="Địa chỉ có thể đã thay đổi hoặc nội dung không còn được hiển thị." action={<Button href="/">Về trang chủ</Button>} />
    </main>
  );
}

export function ContactPage() {
  const { storeSettings, notify } = useStore();
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const storeName = storeSettings?.store_name || "Nước mắm Nam Ô Hương Làng Cổ";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      notify("Vui lòng nhập đầy đủ họ tên, số điện thoại và nội dung.", "error");
      return;
    }
    setSubmitted(true);
    notify("Cảm ơn bạn! Chúng tôi đã tiếp nhận thông tin và sẽ phản hồi sớm nhất.");
  }

  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Liên hệ & Thăm xưởng" }]} />
      <section className="editorial-hero">
        <p className="eyebrow">Kết nối trực tiếp</p>
        <h1>Liên hệ & Thăm xưởng sản xuất</h1>
        <p>Cơ sở Nước mắm Nam Ô — Hương Làng Cổ luôn mở rộng cửa đón chào du khách, đối tác và khách hàng ghé thăm xưởng trải nghiệm di sản.</p>
      </section>

      <div className="cart-layout" style={{ marginTop: "2rem" }}>
        <section className="editorial-content" style={{ flex: "1 1 55%" }}>
          <h2>Thông tin cơ sở sản xuất</h2>
          <p><strong>Đơn vị chủ quản:</strong> CÔNG TY TNHH MẮM HỒNG HƯƠNG</p>
          <p><strong>Người đại diện:</strong> Bùi Thanh Phú (Giám đốc / Nghệ nhân làng nghề)</p>
          <p><strong>Mã số thuế:</strong> 0401801078 (Chi cục Thuế Q. Liên Chiểu, TP. Đà Nẵng)</p>
          <p><strong>Địa chỉ xưởng:</strong> {storeSettings?.store_address || "Tổ 97 (Nam Ô 2), Kiệt 884/74/4 Nguyễn Lương Bằng, Phường Hòa Hiệp Nam, Quận Liên Chiểu, TP. Đà Nẵng"}</p>
          <p><strong>Hotline / Zalo đặt hàng:</strong> <a href={`tel:${storeSettings?.contact_phone || "0935998908"}`}><strong>{storeSettings?.contact_phone || "0935 998 908"}</strong></a></p>
          <p><strong>Email:</strong> <a href={`mailto:${storeSettings?.contact_email || "huonglangco.namo@gmail.com"}`}>{storeSettings?.contact_email || "huonglangco.namo@gmail.com"}</a></p>
          <p><strong>Fanpage Facebook:</strong> <a href="https://www.facebook.com/huonglangco.vn" target="_blank" rel="noopener noreferrer">facebook.com/huonglangco.vn ↗</a></p>
          <p><strong>Giờ đón khách du lịch trải nghiệm:</strong> 07:30 – 17:30 (Tất cả các ngày trong tuần, kể cả Thứ 7 và Chủ Nhật).</p>

          <h2 style={{ marginTop: "2rem" }}>Chỉ dẫn đường đi</h2>
          <p>Từ trung tâm TP. Đà Nẵng, quý khách đi dọc đường Nguyễn Tất Thành hoặc Tôn Đức Thắng nối dài Nguyễn Lương Bằng hướng về phía chân đèo Hải Vân. Đến số 884 Nguyễn Lương Bằng (gần cầu Nam Ô), rẽ vào Kiệt 884 đi thẳng khoảng 200m là đến cổng xưởng mắm truyền thống Hương Làng Cổ.</p>
        </section>

        <aside className="summary-card" style={{ flex: "1 1 40%" }}>
          <h2>Gửi tin nhắn hoặc đặt lịch tham quan</h2>
          {submitted ? (
            <div className="auth-card" style={{ padding: "1.5rem", background: "var(--color-card)" }}>
              <p style={{ color: "var(--color-success)", fontWeight: 600 }}>✓ Gửi tin nhắn thành công!</p>
              <p>Đội ngũ {storeName} đã nhận được lời nhắn của bạn và sẽ liên hệ lại qua số điện thoại <strong>{phone}</strong> trong thời gian sớm nhất.</p>
              <Button onClick={() => setSubmitted(false)} variant="secondary">Gửi tin nhắn khác</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label htmlFor="contact-name" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Họ và tên *</label>
                <input id="contact-name" className="header-search" style={{ width: "100%", padding: "10px" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" required />
              </div>
              <div>
                <label htmlFor="contact-phone" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Số điện thoại *</label>
                <input id="contact-phone" type="tel" className="header-search" style={{ width: "100%", padding: "10px" }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" required />
              </div>
              <div>
                <label htmlFor="contact-email" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Email (nếu có)</label>
                <input id="contact-email" type="email" className="header-search" style={{ width: "100%", padding: "10px" }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div>
                <label htmlFor="contact-msg" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Nội dung cần hỗ trợ / Lịch đoàn *</label>
                <textarea id="contact-msg" rows={4} className="header-search" style={{ width: "100%", padding: "10px" }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Cần tư vấn đặt sỉ, hộp quà biếu hoặc đặt lịch đoàn tham quan..." required />
              </div>
              <Button type="submit" className="button--full">Gửi tin nhắn ngay</Button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}

export function ReturnPolicyPage() {
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Chính sách đổi trả" }]} />
      <section className="editorial-hero">
        <p className="eyebrow">Cam kết chất lượng</p>
        <h1>Chính sách đổi trả & hoàn tiền</h1>
        <p>Quy định đổi trả minh bạch nhằm đảm bảo quyền lợi tối đa cho khách hàng khi mua sắm đặc sản Nước mắm Nam Ô Hương Làng Cổ.</p>
      </section>

      <section className="editorial-content">
        <h2>1. Thời hạn và điều kiện đổi trả</h2>
        <p>Khách hàng được quyền yêu cầu đổi mới sản phẩm hoặc hoàn tiền trong vòng <strong>07 ngày</strong> kể từ thời điểm nhận hàng theo biên bản giao nhận của đơn vị vận chuyển.</p>
        <p>Các trường hợp áp dụng đổi trả miễn phí 100%:</p>
        <ul>
          <li>Chai mắm bị nứt, vỡ, sứt mẻ cổ chai do quá trình đóng gói hoặc vận chuyển đường dài.</li>
          <li>Màng seal nắp chai bị rách, hở hoặc có hiện tượng rò rỉ nước mắm ra ngoài bao bì.</li>
          <li>Giao không đúng số lượng, sai phân loại dung tích (ví dụ đặt chai thủy tinh giao chai nhựa, hoặc thiếu hộp quà tặng).</li>
        </ul>

        <h2>2. Quy trình xử lý đổi trả</h2>
        <ol>
          <li><strong>Bước 1:</strong> Khi bóc hàng, quý khách vui lòng chụp ảnh hoặc quay video ngắn thể hiện rõ tình trạng kiện hàng và sản phẩm bị lỗi.</li>
          <li><strong>Bước 2:</strong> Liên hệ ngay qua Hotline / Zalo: <strong>0935 998 908</strong> hoặc email <strong>huonglangco.namo@gmail.com</strong>, cung cấp mã đơn hàng.</li>
          <li><strong>Bước 3:</strong> Cơ sở Hương Làng Cổ sẽ lập tức gửi kiện hàng mới thay thế hoàn toàn miễn phí (bao gồm cả phí ship gửi bù) hoặc chuyển khoản hoàn tiền 100% lại cho quý khách trong vòng 24 giờ làm việc.</li>
        </ol>

        <h2>3. Lưu ý quan trọng về đặc tính nước mắm truyền thống</h2>
        <p>Nước mắm Nam Ô Hương Làng Cổ là nước mắm nhĩ 100% nguyên chất từ cá cơm than và muối biển Sa Huỳnh, <strong>không sử dụng chất chống oxy hóa sulfite hay phẩm màu hóa học</strong>.</p>
        <p>Hiện tượng nước mắm <em>sẫm màu lại sau một thời gian mở nắp chai</em> tiếp xúc với không khí là phản ứng oxy hóa hoàn toàn tự nhiên của đạm acid amin nguyên chất. Đây là bảo chứng của nước mắm sạch không phụ gia hóa học và không thuộc trường hợp sản phẩm lỗi.</p>
      </section>
    </main>
  );
}

export function PrivacyPolicyPage() {
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Chính sách bảo mật" }]} />
      <section className="editorial-hero">
        <p className="eyebrow">An toàn thông tin</p>
        <h1>Chính sách bảo mật thông tin khách hàng</h1>
        <p>Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân trong hoạt động thương mại điện tử.</p>
      </section>

      <section className="editorial-content">
        <h2>1. Mục đích thu thập dữ liệu cá nhân</h2>
        <p>Chúng tôi chỉ thu thập các thông tin tối thiểu cần thiết để phục vụ quá trình mua hàng và giao nhận đặc sản:</p>
        <ul>
          <li>Họ và tên khách hàng, số điện thoại liên lạc.</li>
          <li>Địa chỉ nhận hàng (số nhà, phường/xã, quận/huyện, tỉnh/thành phố).</li>
          <li>Địa chỉ email (để gửi hóa đơn và thông báo trạng thái đơn hàng).</li>
        </ul>

        <h2>2. Phạm vi sử dụng thông tin</h2>
        <p>Thông tin thu thập chỉ được sử dụng cho các mục đích:</p>
        <ul>
          <li>Xử lý, đóng gói và bàn giao cho đơn vị chuyển phát (Viettel Post, GHTK, EMS) để giao hàng đến tay quý khách.</li>
          <li>Thông báo xác nhận đơn hàng, cập nhật lộ trình giao hàng và chăm sóc sau bán hàng.</li>
          <li>Không bao giờ buôn bán, chia sẻ hoặc tiết lộ thông tin của quý khách cho bất kỳ bên thứ ba nào vì mục đích quảng cáo rác.</li>
        </ul>

        <h2>3. Bảo mật thanh toán và lưu trữ dữ liệu</h2>
        <p>Mật khẩu tài khoản của khách hàng được mã hóa an toàn một chiều bằng thuật toán Bcrypt. Thông tin thẻ hoặc tài khoản ngân hàng của quý khách không được lưu trữ trên máy chủ của chúng tôi mà được bảo mật thông qua giao thức ngân hàng Napas 247 và các đối tác thanh toán chuẩn quốc tế.</p>
      </section>
    </main>
  );
}

export function TermsPage() {
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Điều khoản dịch vụ" }]} />
      <section className="editorial-hero">
        <p className="eyebrow">Quy định mua hàng</p>
        <h1>Điều khoản dịch vụ & Quy chế bán hàng</h1>
        <p>Các điều khoản và quy định giao dịch áp dụng cho tất cả khách hàng đặt mua sản phẩm tại website Nước mắm Nam Ô Hương Làng Cổ.</p>
      </section>

      <section className="editorial-content">
        <h2>1. Quy định đặt hàng và xác nhận đơn</h2>
        <p>Khi quý khách hoàn tất biểu mẫu đặt hàng trực tuyến, hệ thống sẽ tự động tạo một mã đơn hàng duy nhất và gửi email xác nhận. Đơn hàng sẽ được nhân viên xưởng liên hệ xác nhận thông tin trước khi xuất kho đóng gói.</p>

        <h2>2. Chính sách kiểm tra hàng trước khi thanh toán (Đồng kiểm)</h2>
        <p>Chúng tôi áp dụng chính sách <strong>đồng kiểm 100%</strong> đối với tất cả đơn hàng giao toàn quốc. Quý khách hoàn toàn được quyền mở thùng carton kiểm tra số lượng chai, mẫu mã bao bì và tính nguyên vẹn trước khi thanh toán tiền mặt (COD) cho nhân viên giao hàng.</p>

        <h2>3. Phương thức thanh toán chấp nhận</h2>
        <ul>
          <li><strong>Thanh toán khi nhận hàng (COD):</strong> Quý khách thanh toán tiền mặt trực tiếp cho bưu tá khi nhận kiện hàng.</li>
          <li><strong>Chuyển khoản ngân hàng tự động (VietQR / Napas 247):</strong> Quét mã QR hiển thị kèm mã đơn hàng. Tiền được đối soát tự động và đơn hàng được ưu tiên xuất kho nhanh nhất.</li>
          <li><strong>Thanh toán trực tuyến Sandbox / Quốc tế:</strong> Được áp dụng theo các cổng thanh toán tích hợp trên website.</li>
        </ul>
      </section>
    </main>
  );
}

export function OrderLookupPage() {
  const searchParams = useSearchParams();
  const { storeSettings, notify } = useStore();
  const [orderCode, setOrderCode] = useState(searchParams.get("code") || "");
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const fetchOrder = useCallback(async (code: string, phoneNumber: string) => {
    if (!code.trim() || !phoneNumber.trim()) return;
    setLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const result = await api.lookupOrder({ order_code: code.trim(), phone: phoneNumber.trim() });
      setOrder(result);
    } catch (cause) {
      setOrder(null);
      setError(cause instanceof ApiError ? cause.message : "Không tìm thấy đơn hàng. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const code = searchParams.get("code");
    const phoneNumber = searchParams.get("phone");
    if (code && phoneNumber) {
      setOrderCode(code);
      setPhone(phoneNumber);
      void fetchOrder(code, phoneNumber);
    }
  }, [searchParams, fetchOrder]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orderCode.trim()) {
      setError("Vui lòng nhập mã đơn hàng.");
      return;
    }
    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại đặt hàng.");
      return;
    }
    await fetchOrder(orderCode, phone);
  }

  async function handleCancel() {
    if (!order) return;
    if (!window.confirm("Bạn có chắc chắn muốn hủy đơn hàng này không?")) return;
    setCancelBusy(true);
    try {
      await api.cancelPublicOrder({ order_code: order.order_code, phone: order.customer_phone });
      notify("Đã hủy đơn hàng thành công.");
      await fetchOrder(order.order_code, order.customer_phone);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Chưa thể hủy đơn hàng.", "error");
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Tra cứu đơn hàng" }]} />
      <section className="page-heading">
        <p className="eyebrow">Hành trình đơn hàng</p>
        <h1>Tra cứu đơn hàng</h1>
        <p>Kiểm tra thông tin chi tiết, tiến độ giao hàng và quét mã thanh toán VietQR.</p>
      </section>

      <div className="lookup-layout">
        <form className="lookup-form-card" onSubmit={handleSubmit}>
          <div className="lookup-form-grid">
            <label htmlFor="lookup_code">
              Mã đơn hàng <strong>*</strong>
              <input
                id="lookup_code"
                type="text"
                placeholder="Ví dụ: NO..."
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                required
              />
            </label>
            <label htmlFor="lookup_phone">
              Số điện thoại người nhận <strong>*</strong>
              <input
                id="lookup_phone"
                type="tel"
                placeholder="Số điện thoại lúc đặt hàng"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
          </div>
          {error && <div className="inline-error" style={{ marginBottom: "1rem" }}>{error}</div>}
          <Button type="submit" disabled={loading} className="button--full">
            {loading ? "Đang tra cứu…" : "Tra cứu đơn hàng"}
          </Button>
        </form>

        {loading && <Loading label="Đang đối soát thông tin đơn hàng…" />}

        {!loading && hasSearched && !order && !error && (
          <EmptyState
            title="Không tìm thấy đơn hàng"
            description="Vui lòng kiểm tra lại chính xác Mã đơn hàng và Số điện thoại đã dùng khi mua hàng."
          />
        )}

        {order && (
          <article className="lookup-result-card">
            <div className="order-status-banner">
              <div>
                <span style={{ fontSize: "0.85rem", color: "var(--color-muted)", display: "block" }}>
                  Mã đơn hàng: <strong>{order.order_code}</strong>
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                  Ngày đặt: {formatDate(order.created_at)}
                </span>
              </div>
              <span className={`order-status-badge order-status-badge--${order.status.toLowerCase()}`}>
                {orderStatus(order.status)}
              </span>
            </div>

            <h3 className="lookup-section-title">Danh sách sản phẩm</h3>
            <div className="lookup-items-list">
              {order.items?.map((item, index) => (
                <div className="lookup-item-row" key={index}>
                  <div>
                    <strong>{item.product_name}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>
                      {item.variant_name} · Số lượng: {item.quantity}
                    </div>
                  </div>
                  <div><Price value={item.subtotal} /></div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "1.25rem", padding: "1rem", background: "var(--color-sand-light)", borderRadius: "8px" }}>
              <div className="summary-row"><span>Tạm tính</span><Price value={order.subtotal} /></div>
              {Number(order.discount_amount) > 0 && (
                <div className="summary-row" style={{ color: "var(--color-wood)" }}>
                  <span>Giảm giá ({order.coupon_code || "Ưu đãi"})</span>
                  <span>-{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(order.discount_amount))}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Phí vận chuyển</span>
                {Number(order.shipping_fee) === 0 ? "Miễn phí" : <Price value={order.shipping_fee} />}
              </div>
              <div className="summary-row summary-row--total" style={{ borderTop: "1px dashed var(--color-line)", paddingTop: "8px", marginTop: "6px" }}>
                <strong>Tổng thanh toán</strong>
                <Price value={order.total_amount} />
              </div>
            </div>

            <h3 className="lookup-section-title">Thông tin giao nhận</h3>
            <div className="lookup-info-grid">
              <div className="lookup-info-item">
                <strong>Người nhận:</strong>
                {order.customer_name}
              </div>
              <div className="lookup-info-item">
                <strong>Số điện thoại:</strong>
                {order.customer_phone}
              </div>
              <div className="lookup-info-item" style={{ gridColumn: "1 / -1" }}>
                <strong>Địa chỉ giao hàng:</strong>
                {[order.shipping_address_line, order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(", ")}
              </div>
              {order.note && (
                <div className="lookup-info-item" style={{ gridColumn: "1 / -1" }}>
                  <strong>Ghi chú:</strong>
                  {order.note}
                </div>
              )}
            </div>

            <h3 className="lookup-section-title">Thanh toán</h3>
            <p style={{ margin: "4px 0", fontSize: "0.95rem" }}>
              Phương thức: <strong>{order.payments?.[0]?.payment_method === "COD" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản VietQR (Napas 247)"}</strong> · Trạng thái: <strong>{order.payments?.[0]?.payment_status === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}</strong>
            </p>

            {order.payments?.[0]?.payment_method === "BANK_TRANSFER" && order.payments?.[0]?.payment_status !== "PAID" && (
              <div className="bank-transfer-details" style={{ marginTop: "1rem", padding: "1.25rem", background: "#fff", borderRadius: "8px", border: "1px solid var(--color-line)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center" }}>
                  <div style={{ textAlign: "center", background: "#fff", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getVietQrUrl(storeSettings?.bank_account_number, storeSettings?.bank_name, order.total_amount, order.order_code)}
                      alt={`Mã VietQR ${order.order_code}`}
                      width={160}
                      height={160}
                      style={{ display: "block", margin: "0 auto" }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#666", display: "block", marginTop: "4px", fontWeight: 600 }}>Quét mã qua App Ngân hàng</span>
                  </div>
                  <div style={{ flex: "1 1 240px" }}>
                    <p style={{ margin: "3px 0", fontSize: "0.88rem" }}>Ngân hàng: <strong>{storeSettings?.bank_name || "ACMEBank"}</strong></p>
                    <p style={{ margin: "3px 0", fontSize: "0.88rem" }}>
                      Số tài khoản: <strong>{storeSettings?.bank_account_number || "3897126450"}</strong>
                      <CopyTextButton text={storeSettings?.bank_account_number || "3897126450"} />
                    </p>
                    {storeSettings?.bank_branch && (
                      <p style={{ margin: "3px 0", fontSize: "0.82rem", color: "var(--color-wood)" }}>
                        {storeSettings.bank_branch}
                        <CopyTextButton text="SBPAY9735061428" label="Chép TK ảo" />
                      </p>
                    )}
                    <p style={{ margin: "3px 0", fontSize: "0.88rem" }}>Chủ tài khoản: <strong>{storeSettings?.bank_account_holder || "NGUYEN NGUYEN PHUC"}</strong></p>
                    <p style={{ margin: "3px 0", fontSize: "0.88rem" }}>
                      Số tiền: <strong>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(order.total_amount))}</strong>
                      <CopyTextButton text={String(order.total_amount)} label="Sao chép tiền" />
                    </p>
                    <div style={{ margin: "6px 0", fontSize: "0.88rem", background: "#FAF8F4", padding: "6px 10px", borderRadius: "6px", border: "1px dashed var(--color-gold)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>Nội dung CK: <strong style={{ color: "var(--color-wood)" }}>{order.order_code}</strong></span>
                      <CopyTextButton text={order.order_code} label="Sao chép" />
                    </div>
                    <div style={{ marginTop: "10px" }}>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.simulateSepayPayment(order.id);
                            notify("Giả lập webhook SePay thành công!");
                            await fetchOrder(order.order_code, order.customer_phone);
                          } catch {
                            notify("Không thể kích hoạt giả lập.", "error");
                          }
                        }}
                        className="copy-pill-button"
                        style={{ padding: "5px 12px", fontSize: "0.8rem", background: "#E8F5E9", color: "#1B5E20" }}
                      >
                        🧪 Giả lập thanh toán SePay thành công
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {order.can_cancel && (
              <div style={{ marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid var(--color-line)", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="button button--danger"
                  disabled={cancelBusy}
                  onClick={() => void handleCancel()}
                >
                  {cancelBusy ? "Đang xử lý…" : "Hủy đơn hàng này"}
                </button>
              </div>
            )}
          </article>
        )}
      </div>
    </main>
  );
}

