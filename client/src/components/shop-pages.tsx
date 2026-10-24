"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { formatDate, orderStatus } from "@/lib/format";
import type { BlogPost, Order } from "@/lib/types";
import { useStore } from "./providers";
import { Breadcrumb, Button, EmptyState, ErrorState, Loading, Price, ProductImage } from "./ui";

export function CartPage() {
  const { user, cart, cartLoading, refreshCart, notify } = useStore();
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    if (!user) return;
    void refreshCart().catch(() => setError("Không thể tải giỏ hàng."));
  }, [user, refreshCart, retryKey]);

  const items = cart?.items ?? [];
  const total = items.reduce((sum, item) => sum + Number(item.line_total), 0);

  async function updateItem(id: number, quantity: number) {
    setBusyItem(id);
    setError("");
    try {
      await api.updateCartItem(id, quantity);
      await refreshCart();
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
      await api.removeCartItem(id);
      await refreshCart();
      notify("Đã xóa sản phẩm khỏi giỏ.");
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
      {!user ? <EmptyState title="Đăng nhập để xem giỏ hàng" description="Giỏ hàng được lưu trên tài khoản của bạn." action={<Button href="/dang-nhap?next=%2Fgio-hang">Đăng nhập</Button>} />
        : cartLoading && !cart ? <Loading label="Đang tải giỏ hàng…" />
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
                      <div className="summary-row"><span>Tạm tính</span><Price value={total} /></div>
                      <div className="summary-row"><span>Phí giao hàng</span><span>Tính khi đặt hàng</span></div>
                      <div className="summary-row summary-row--total"><strong>Tổng tạm tính</strong><Price value={total} /></div>
                      <p>Giá và tồn kho sẽ được máy chủ kiểm tra lại khi bạn đặt hàng.</p>
                      <Button href="/thanh-toan" className="button--full">Tiến hành thanh toán</Button>
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
  shipping_province: z.string().trim().min(1, "Vui lòng nhập tỉnh/thành phố.").max(120),
  shipping_district: z.string().trim().max(120),
  shipping_ward: z.string().trim().max(120),
  shipping_address_line: z.string().trim().min(2, "Vui lòng nhập địa chỉ.").max(255),
  note: z.string().max(1000),
  payment_method: z.enum(["COD", "BANK_TRANSFER"]),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
  const router = useRouter();
  const { user, cart, cartLoading, refreshCart, notify, storeSettings, storeSettingsLoading, storeSettingsError } = useStore();
  const [values, setValues] = useState<CheckoutValues>({
    customer_name: "", customer_phone: "", shipping_province: "", shipping_district: "", shipping_ward: "",
    shipping_address_line: "", note: "", payment_method: "COD",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutValues, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setValues((current) => ({
      ...current,
      customer_name: current.customer_name || user.fullName,
      customer_phone: current.customer_phone || user.phone || "",
    }));
  }, [user]);

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
      const { customer_name, customer_phone, shipping_province, shipping_district, shipping_ward, shipping_address_line, note, payment_method } = parsed.data;
      const order = await api.createOrder({
        payment_method, customer_name, customer_phone, shipping_province, shipping_address_line,
        shipping_district: shipping_district || undefined, shipping_ward: shipping_ward || undefined,
        note: note || undefined,
      });
      await refreshCart();
      sessionStorage.setItem("last-order-id", String(order.id));
      notify("Đặt hàng thành công.");
      router.push(`/dat-hang-thanh-cong?id=${encodeURIComponent(String(order.id))}`);
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

  const total = cart?.items.reduce((sum, item) => sum + Number(item.line_total), 0) ?? 0;
  const fee = storeSettings?.shipping_fee === null || storeSettings?.shipping_fee === undefined
    ? null
    : Number(storeSettings.shipping_fee);
  const freeShipping = Boolean(storeSettings?.free_shipping_enabled)
    && storeSettings?.free_shipping_minimum !== null
    && storeSettings?.free_shipping_minimum !== undefined
    && total >= Number(storeSettings.free_shipping_minimum);
  const estimatedShipping = fee === null ? null : freeShipping ? 0 : fee;
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Giỏ hàng", href: "/gio-hang" }, { label: "Thanh toán" }]} />
      <section className="page-heading"><p className="eyebrow">Hoàn tất đơn hàng</p><h1>Thanh toán</h1></section>
      {!user ? <EmptyState title="Vui lòng đăng nhập" description="Checkout hiện chỉ dành cho khách hàng đã đăng nhập." action={<Button href="/dang-nhap?next=%2Fthanh-toan">Đăng nhập</Button>} />
        : cartLoading && !cart ? <Loading label="Đang kiểm tra giỏ hàng…" />
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
                    {storeSettingsLoading ? <p>Đang tải phương thức thanh toán…</p> : paymentMethods.length === 0
                      ? <p>Chưa có phương thức thanh toán khả dụng. Vui lòng liên hệ cửa hàng sau khi thông tin được cấu hình.</p>
                      : <>
                        {storeSettings?.cod_enabled && <label><input type="radio" name="payment_method" value="COD" checked={values.payment_method === "COD"} onChange={() => field("payment_method", "COD")} /> Thanh toán khi nhận hàng (COD)</label>}
                        {storeSettings?.bank_transfer_enabled && <label><input type="radio" name="payment_method" value="BANK_TRANSFER" checked={values.payment_method === "BANK_TRANSFER"} onChange={() => field("payment_method", "BANK_TRANSFER")} /> Chuyển khoản ngân hàng</label>}
                        <p>Thanh toán sẽ ở trạng thái chờ xác nhận; website chưa tích hợp cổng thanh toán.</p>
                      </>}
                    {values.payment_method === "BANK_TRANSFER" && storeSettings?.bank_transfer_enabled && <div className="bank-transfer-details">
                      <strong>Thông tin nhận chuyển khoản</strong>
                      <span>{storeSettings.bank_name}</span>
                      <span>{storeSettings.bank_account_number}</span>
                      <span>{storeSettings.bank_account_holder}</span>
                      {storeSettings.bank_branch && <span>{storeSettings.bank_branch}</span>}
                    </div>}
                  </fieldset>
                  {storeSettingsError && <div className="inline-error" role="alert">Không thể tải cài đặt giao hàng và thanh toán. Vui lòng tải lại trang trước khi đặt hàng.</div>}
                  {submitError && <div className="inline-error" role="alert">{submitError}</div>}
                  <Button type="submit" disabled={loading || storeSettingsLoading || !storeSettings || fee === null || paymentMethods.length === 0}>{loading ? "Đang gửi đơn…" : "Đặt hàng"}</Button>
                </form>
                <aside className="summary-card">
                  <h2>Đơn hàng của bạn</h2>
                  {cart.items.map((item) => <div className="summary-row" key={item.id}><span>{item.product_name} · {item.variant_name} × {item.quantity}</span><Price value={item.line_total} /></div>)}
                  <div className="summary-row"><span>Tạm tính</span><Price value={total} /></div>
                  <div className="summary-row"><span>Phí giao hàng</span>{estimatedShipping === null ? <span>Chưa cấu hình</span> : <Price value={estimatedShipping} />}</div>
                  {freeShipping && <p>Đơn hàng đạt mức miễn phí vận chuyển.</p>}
                  <div className="summary-row summary-row--total"><strong>Tổng dự kiến</strong>{estimatedShipping === null ? <span>Chưa xác định</span> : <Price value={total + estimatedShipping} />}</div>
                  <p>Giá, khuyến mãi, phí vận chuyển và tồn kho được máy chủ xác thực khi đặt hàng.</p>
                </aside>
              </div>
            )}
    </main>
  );
}

export function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const { storeSettings } = useStore();
  const id = Number(searchParams.get("id"));
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const stored = sessionStorage.getItem("last-order-id");
    const orderId = Number.isInteger(id) && id > 0 ? id : Number(stored);
    if (!orderId) {
      setError("Không tìm thấy thông tin đơn hàng gần đây.");
      setLoading(false);
      return;
    }
    let active = true;
    void api.order(orderId).then((result) => {
      if (active) setOrder(result);
    }).catch((cause) => {
      if (active) setError(cause instanceof ApiError ? cause.message : "Không thể tải thông tin đơn hàng.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

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
                <p>Thanh toán <strong>{order.payments?.[0]?.payment_method === "COD" ? "Thanh toán khi nhận hàng" : "Chuyển khoản ngân hàng"} · Chờ xác nhận</strong></p>
                {order.payments?.[0]?.payment_method === "BANK_TRANSFER" && storeSettings?.bank_transfer_enabled && <div className="bank-transfer-details">
                  <strong>Thông tin nhận chuyển khoản</strong>
                  <span>{storeSettings.bank_name}</span><span>{storeSettings.bank_account_number}</span><span>{storeSettings.bank_account_holder}</span>
                  {storeSettings.bank_branch && <span>{storeSettings.bank_branch}</span>}
                </div>}
              </div>
            )}
        <div className="success-card__actions">
          {order && <Button href={`/tai-khoan/don-hang/${order.id}`}>Xem đơn hàng</Button>}
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
  const { user, authLoading, storeSettings } = useStore();
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
                  {order.payments?.map((payment, index) => <p key={`${payment.payment_method}-${index}`}>{payment.payment_method === "COD" ? "Thanh toán khi nhận hàng" : "Chuyển khoản ngân hàng"} · {payment.payment_status === "PENDING" ? "Chờ xác nhận" : payment.payment_status}</p>)}
                  {order.payments?.some((payment) => payment.payment_method === "BANK_TRANSFER") && storeSettings?.bank_transfer_enabled && <div className="bank-transfer-details">
                    <strong>Thông tin nhận chuyển khoản</strong>
                    <span>{storeSettings.bank_name}</span><span>{storeSettings.bank_account_number}</span><span>{storeSettings.bank_account_holder}</span>
                    {storeSettings.bank_branch && <span>{storeSettings.bank_branch}</span>}
                  </div>}
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
  const storeName = storeSettings?.store_name.trim();
  return (
    <main className="page-shell container">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Về thương hiệu" }]} />
      <section className="editorial-hero">
        {storeName && <p className="eyebrow">{storeName}</p>}
        <h1>Câu chuyện thương hiệu</h1>
        <p>Nội dung chính thức đang chờ chủ thương hiệu cung cấp.</p>
      </section>
      <section className="editorial-content">
        <h2>Chia sẻ từ chủ thương hiệu</h2>
        <p>Chúng tôi sẽ cập nhật câu chuyện, hình ảnh và thông tin về thương hiệu tại đây khi được cung cấp. Hiện tại, website không tự đưa ra tuyên bố về lịch sử, nguồn nguyên liệu hay quy trình sản xuất.</p>
        <Button href="/san-pham">Xem danh mục sản phẩm</Button>
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
