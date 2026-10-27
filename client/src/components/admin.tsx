"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, api, apiBaseUrl, type AdminDashboardStats, type AdminRecord, type AdminUserDetail } from "@/lib/api";
import type { AdminStoreSettings, Order, Product, ProductImage, ProductVariant, User } from "@/lib/types";
import { EmptyState, Loading, Pagination } from "@/components/ui";
import { useStore } from "@/components/providers";

type ResourceKey =
  | "categories" | "products" | "inventory" | "orders" | "users" | "reviews"
  | "coupons" | "banners" | "videos" | "social-links" | "blog/categories" | "blog/posts" | "settings";

type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "url" | "email" | "textarea" | "select" | "checkbox" | "datetime";
  required?: boolean;
  nullable?: boolean;
  step?: string;
  options?: Array<{ value: string; label: string }>;
};

const statusOptions = (values: string[]) => values.map((value) => ({ value, label: value }));
const fieldSets: Partial<Record<ResourceKey, Field[]>> = {
  categories: [
    { name: "name", label: "Tên danh mục", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "description", label: "Mô tả", type: "textarea", nullable: true },
    { name: "image_url", label: "Đường dẫn ảnh", type: "url", nullable: true },
    { name: "status", label: "Trạng thái", type: "select", options: statusOptions(["ACTIVE", "INACTIVE", "ARCHIVED"]) },
    { name: "sort_order", label: "Thứ tự", type: "number", step: "1", required: true },
  ],
  products: [
    { name: "category_id", label: "ID danh mục", type: "number", step: "1", required: true },
    { name: "name", label: "Tên sản phẩm", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "short_description", label: "Mô tả ngắn", type: "textarea", nullable: true },
    { name: "description", label: "Mô tả", type: "textarea", nullable: true },
    { name: "status", label: "Trạng thái", type: "select", options: statusOptions(["DRAFT", "ACTIVE", "ARCHIVED"]) },
  ],
  users: [
    { name: "role", label: "Vai trò", type: "select", options: statusOptions(["CUSTOMER", "STAFF", "ADMIN"]) },
    { name: "status", label: "Trạng thái tài khoản", type: "select", options: statusOptions(["ACTIVE", "INACTIVE", "LOCKED"]) },
  ],
  coupons: [
    { name: "code", label: "Mã ưu đãi", required: true },
    { name: "name", label: "Tên ưu đãi", required: true },
    { name: "discount_type", label: "Loại giảm", type: "select", options: [{ value: "PERCENTAGE", label: "Phần trăm" }, { value: "FIXED_AMOUNT", label: "Số tiền cố định" }] },
    { name: "discount_value", label: "Giá trị giảm", type: "number", step: "0.01", required: true },
    { name: "minimum_order_amount", label: "Đơn hàng tối thiểu", type: "number", step: "0.01", required: true },
    { name: "max_discount_amount", label: "Giảm tối đa", type: "number", step: "0.01", nullable: true },
    { name: "usage_limit", label: "Giới hạn lượt dùng", type: "number", step: "1", nullable: true },
    { name: "start_at", label: "Bắt đầu", type: "datetime", nullable: true },
    { name: "end_at", label: "Kết thúc", type: "datetime", nullable: true },
    { name: "status", label: "Trạng thái", type: "select", options: statusOptions(["ACTIVE", "INACTIVE", "EXPIRED"]) },
  ],
  banners: [
    { name: "title", label: "Tiêu đề", required: true },
    { name: "image_url", label: "URL ảnh", type: "url", required: true },
    { name: "link_url", label: "URL liên kết", type: "url", nullable: true },
    { name: "sort_order", label: "Thứ tự", type: "number", step: "1", required: true },
    { name: "is_active", label: "Đang hoạt động", type: "checkbox" },
    { name: "start_at", label: "Bắt đầu", type: "datetime", nullable: true },
    { name: "end_at", label: "Kết thúc", type: "datetime", nullable: true },
  ],
  videos: [
    { name: "title", label: "Tiêu đề", required: true },
    { name: "description", label: "Mô tả", type: "textarea", nullable: true },
    { name: "video_url", label: "YouTube URL", type: "url", required: true },
    { name: "thumbnail_url", label: "URL ảnh bìa", type: "url", nullable: true },
    { name: "platform", label: "Nền tảng", type: "select", options: [{ value: "YOUTUBE", label: "YouTube" }] },
    { name: "is_active", label: "Đang hoạt động", type: "checkbox" },
    { name: "sort_order", label: "Thứ tự", type: "number", step: "1", required: true },
  ],
  "social-links": [
    { name: "platform", label: "Nền tảng", type: "select", options: statusOptions(["FACEBOOK", "TIKTOK", "YOUTUBE"]) },
    { name: "name", label: "Tên liên kết", required: true },
    { name: "url", label: "URL", type: "url", required: true },
    { name: "icon", label: "Tên icon (nếu có)", nullable: true },
    { name: "is_active", label: "Đang hoạt động", type: "checkbox" },
    { name: "sort_order", label: "Thứ tự", type: "number", step: "1", required: true },
  ],
  "blog/categories": [
    { name: "name", label: "Tên danh mục", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "description", label: "Mô tả", type: "textarea", nullable: true },
    { name: "status", label: "Trạng thái", type: "select", options: statusOptions(["ACTIVE", "INACTIVE", "ARCHIVED"]) },
    { name: "sort_order", label: "Thứ tự", type: "number", step: "1", required: true },
  ],
  "blog/posts": [
    { name: "category_id", label: "ID danh mục bài viết", type: "number", step: "1", nullable: true },
    { name: "title", label: "Tiêu đề", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "excerpt", label: "Tóm tắt", type: "textarea", nullable: true },
    { name: "content", label: "Nội dung văn bản", type: "textarea", required: true },
    { name: "thumbnail_url", label: "URL ảnh đại diện", type: "url", nullable: true },
    { name: "status", label: "Trạng thái", type: "select", options: statusOptions(["DRAFT", "PUBLISHED", "ARCHIVED"]) },
    { name: "published_at", label: "Thời gian xuất bản", type: "datetime", nullable: true },
  ],
};

const resourceLabels: Record<ResourceKey, string> = {
  categories: "Danh mục sản phẩm",
  products: "Sản phẩm",
  inventory: "Kho hàng",
  orders: "Đơn hàng",
  users: "Khách hàng & tài khoản",
  reviews: "Đánh giá",
  coupons: "Mã ưu đãi",
  banners: "Banner",
  videos: "Video",
  "social-links": "Liên kết mạng xã hội",
  "blog/categories": "Danh mục bài viết",
  "blog/posts": "Bài viết",
  settings: "Cài đặt cửa hàng",
};

const navGroups: Array<{ heading: string; links: Array<{ key: ResourceKey; label: string }> }> = [
  { heading: "Cửa hàng", links: [
    { key: "products", label: "Sản phẩm" }, { key: "categories", label: "Danh mục" },
    { key: "inventory", label: "Kho hàng" }, { key: "orders", label: "Đơn hàng" },
    { key: "users", label: "Khách hàng" }, { key: "reviews", label: "Đánh giá" },
  ] },
  { heading: "Nội dung", links: [
    { key: "coupons", label: "Mã ưu đãi" }, { key: "banners", label: "Banner" },
    { key: "videos", label: "Video" },
    { key: "blog/categories", label: "Danh mục bài viết" }, { key: "blog/posts", label: "Bài viết" },
  ] },
  { heading: "Hệ thống", links: [{ key: "settings", label: "Cài đặt cửa hàng" }] },
];

function safeMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-access-denied", { detail: error.status }));
  }
  return error instanceof ApiError ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

function recordValue(row: AdminRecord, key: string): unknown {
  return row[key];
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "object") return "—";
  return String(value);
}

function isSafeUploadPath(value: string): boolean {
  if (!value.startsWith("/uploads/") || value.includes("\\")) return false;
  try {
    return !decodeURIComponent(value).split("/").includes("..");
  } catch {
    return false;
  }
}

function localDateTimeValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function rowId(row: AdminRecord): number {
  return Number(row.id);
}

function statusTone(value: unknown): string {
  const status = String(value ?? "").toLowerCase();
  if (["active", "approved", "delivered", "published", "confirmed"].includes(status)) return "admin-status--good";
  if (["rejected", "cancelled", "archived", "locked", "inactive", "hidden"].includes(status)) return "admin-status--bad";
  return "";
}

function FieldInput({ field, value, onChange }: { field: Field; value: string | boolean; onChange: (value: string | boolean) => void }) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState("");
  if (field.type === "checkbox") {
    return <label className="admin-checkbox"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />{field.label}</label>;
  }
  if (field.type === "select") {
    return <label className="admin-form-field"><span>{field.label}</span><select required={field.required} value={String(value)} onChange={(event) => onChange(event.target.value)}>
      {(field.options ?? []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
    </select></label>;
  }
  const type = field.type === "datetime" ? "datetime-local" : field.type === "number" ? "number" : field.type === "url" ? "url" : field.type === "email" ? "email" : "text";
  const inputValue = field.type === "datetime" && typeof value === "string" && value ? localDateTimeValue(value) : String(value ?? "");
  const props = {
    required: field.required,
    value: inputValue,
    step: field.step,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };
  const imageSource = (field.name === "image_url" || field.name === "thumbnail_url") && field.type === "url" && typeof value === "string"
    ? value.trim()
    : "";
  const previewUrl = imageSource.startsWith("/uploads/")
    ? `${apiBaseUrl().replace(/\/api\/?$/, "")}${imageSource}`
    : imageSource;
  let validPreviewUrl = "";
  try {
    const parsedUrl = new URL(previewUrl);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") validPreviewUrl = previewUrl;
  } catch {
    validPreviewUrl = "";
  }
  return <label className="admin-form-field"><span>{field.label}</span>
    {field.type === "textarea" ? <textarea {...props} rows={4} /> : <input {...props} type={type} />}
    {validPreviewUrl && <span className="admin-image-preview">
      {failedPreviewUrl === validPreviewUrl ? "Không tải được ảnh xem trước." : <Image
        src={validPreviewUrl}
        alt=""
        width={360}
        height={180}
        unoptimized
        onError={() => setFailedPreviewUrl(validPreviewUrl)}
      />}
    </span>}
  </label>;
}

function ResourceForm({
  fields, initial, onCancel, onSave, busy, title,
}: {
  fields: Field[];
  initial?: AdminRecord;
  onCancel: () => void;
  onSave: (payload: AdminRecord) => Promise<void>;
  busy?: boolean;
  title: string;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => Object.fromEntries(fields.map((field) => {
    const value = initial?.[field.name];
    if (field.type === "checkbox") return [field.name, value === true || value === 1];
    return [field.name, value === null || value === undefined ? (field.type === "select" ? field.options?.[0]?.value ?? "" : "") : String(value)];
  })));
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: AdminRecord = {};
    for (const field of fields) {
      const raw = values[field.name];
      if (field.type === "checkbox") {
        payload[field.name] = raw === true;
      } else if (field.type === "number") {
        if (raw === "" && field.nullable) payload[field.name] = null;
        else {
          const number = Number(raw);
          if (!Number.isFinite(number) || (field.required && raw === "") || number < 0
            || (field.step === "1" && !Number.isInteger(number))
            || (["category_id", "volume", "usage_limit"].includes(field.name) && number === 0)) {
            setFormError(`Vui lòng nhập giá trị hợp lệ cho “${field.label}”.`);
            return;
          }
          payload[field.name] = number;
        }
      } else if (field.type === "datetime") {
        if (raw && Number.isNaN(new Date(String(raw)).valueOf())) {
          setFormError(`Thời gian “${field.label}” chưa hợp lệ.`);
          return;
        }
        payload[field.name] = raw ? new Date(String(raw)).toISOString() : null;
      } else {
        const text = String(raw ?? "").trim();
        if (field.required && !text) {
          setFormError(`Vui lòng nhập “${field.label}”.`);
          return;
        }
        if (field.type === "url" && text) {
          const imagePath = (field.name === "image_url" || field.name === "thumbnail_url") && isSafeUploadPath(text);
          if (!imagePath) {
            try {
              const url = new URL(text);
              if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
            } catch {
              setFormError(`URL “${field.label}” chưa hợp lệ.`);
              return;
            }
          }
        }
        payload[field.name] = text || (field.nullable ? null : "");
      }
    }
    if (fields.some((field) => field.name === "slug") && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(payload.slug ?? ""))) {
      setFormError("Slug chỉ gồm chữ thường không dấu, số và dấu gạch nối.");
      return;
    }
    if (payload.discount_type === "PERCENTAGE" && Number(payload.discount_value) > 100) {
      setFormError("Mức giảm phần trăm không được vượt quá 100.");
      return;
    }
    if (payload.start_at && payload.end_at && String(payload.start_at) >= String(payload.end_at)) {
      setFormError("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }
    if (payload.platform === "YOUTUBE" && typeof payload.video_url === "string") {
      try {
        const host = new URL(payload.video_url).hostname.toLowerCase();
        if (!(host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be")) {
          setFormError("Chỉ chấp nhận URL chính thức của YouTube.");
          return;
        }
      } catch {
        setFormError("URL YouTube chưa hợp lệ.");
        return;
      }
    }
    if (fields.some((field) => field.name === "slug") && !String(payload.slug ?? "")) {
      setFormError("Slug là bắt buộc.");
      return;
    }
    setFormError("");
    try {
      await onSave(payload);
    } catch (error) {
      setFormError(safeMessage(error));
    }
  }

  return <form className="admin-form" onSubmit={submit} noValidate>
    <div className="admin-form__heading"><h2>{title}</h2><button type="button" className="admin-icon-button" onClick={onCancel} aria-label="Đóng">×</button></div>
    <div className="admin-form__fields">{fields.map((field) => <FieldInput
      field={field} key={field.name} value={values[field.name] ?? ""}
      onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
    />)}</div>
    {formError && <p className="admin-form-error" role="alert">{formError}</p>}
    <div className="admin-form__actions"><button type="button" className="admin-button admin-button--quiet" onClick={onCancel}>Hủy</button>
      <button className="admin-button admin-button--primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></div>
  </form>;
}

export function AdminLoginPage() {
  const router = useRouter();
  const { user, authLoading, setUser, refreshUser } = useStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!authLoading && user?.role === "ADMIN") router.replace("/admin");
  }, [authLoading, router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!identifier.trim() || !password) {
      setError("Vui lòng nhập email hoặc số điện thoại và mật khẩu.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.login({ identifier: identifier.trim(), password });
      if (result.user.role !== "ADMIN") {
        await api.logout().catch(() => undefined);
        setUser(null);
        router.replace("/dang-nhap?next=%2Ftai-khoan");
        return;
      }
      setUser(result.user);
      await refreshUser();
      router.replace("/admin");
    } catch (cause) {
      setError(safeMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return <main className="admin-login-page">
    <form className="admin-login-card" onSubmit={submit} noValidate>
      <span className="admin-brand-mark" aria-hidden="true">A</span>
      <p className="admin-eyebrow">Khu vực quản trị</p>
      <h1>Đăng nhập quản trị</h1>
      <p>Quyền truy cập được máy chủ xác thực theo tài khoản quản trị.</p>
      <label className="admin-form-field"><span>Email hoặc số điện thoại</span><input autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></label>
      <label className="admin-form-field"><span>Mật khẩu</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      <button className="admin-button admin-button--primary admin-button--wide" type="submit" disabled={busy || authLoading}>{busy ? "Đang xác thực…" : "Đăng nhập"}</button>
      <Link href="/">Quay lại cửa hàng</Link>
    </form>
  </main>;
}

function titleFor(key: ResourceKey | null): string {
  return key ? resourceLabels[key] : "Tổng quan";
}

function resolveResource(section: string[]): { key: ResourceKey | null; id: number | null } {
  if (!section.length) return { key: null, id: null };
  const path = section.slice(0, 2).join("/");
  const candidate = (["blog/categories", "blog/posts"].includes(path) ? path : section[0]) as ResourceKey;
  const known: ResourceKey[] = ["categories", "products", "inventory", "orders", "users", "reviews", "coupons", "banners", "videos", "social-links", "blog/categories", "blog/posts", "settings"];
  return { key: known.includes(candidate) ? candidate : null, id: /^\d+$/.test(section[1] ?? "") ? Number(section[1]) : null };
}

function resourceColumns(key: ResourceKey): Array<{ key: string; label: string }> {
  const sets: Record<ResourceKey, Array<{ key: string; label: string }>> = {
    categories: [{ key: "name", label: "Tên" }, { key: "slug", label: "Slug" }, { key: "status", label: "Trạng thái" }, { key: "sort_order", label: "Thứ tự" }],
    products: [{ key: "name", label: "Sản phẩm" }, { key: "category_name", label: "Danh mục" }, { key: "starting_price", label: "Giá từ" }, { key: "status", label: "Trạng thái" }],
    inventory: [{ key: "product_name", label: "Sản phẩm" }, { key: "variant_name", label: "Phiên bản" }, { key: "sku", label: "SKU" }, { key: "quantity", label: "Tồn kho" }, { key: "reserved_quantity", label: "Đã giữ" }, { key: "available_quantity", label: "Khả dụng" }],
    orders: [{ key: "order_code", label: "Mã đơn" }, { key: "customer_name", label: "Khách hàng" }, { key: "customer_phone", label: "Điện thoại" }, { key: "total_amount", label: "Tổng tiền" }, { key: "status", label: "Trạng thái" }, { key: "created_at", label: "Ngày tạo" }],
    users: [{ key: "full_name", label: "Tên khách hàng" }, { key: "email", label: "Email" }, { key: "phone", label: "Điện thoại" }, { key: "role", label: "Vai trò" }, { key: "status", label: "Trạng thái" }],
    reviews: [{ key: "product_name", label: "Sản phẩm" }, { key: "customer_name", label: "Khách hàng" }, { key: "rating", label: "Điểm" }, { key: "comment", label: "Nội dung" }, { key: "status", label: "Trạng thái" }, { key: "created_at", label: "Ngày tạo" }],
    coupons: [{ key: "code", label: "Mã" }, { key: "name", label: "Tên" }, { key: "discount_type", label: "Kiểu giảm" }, { key: "discount_value", label: "Giá trị" }, { key: "status", label: "Trạng thái" }],
    banners: [{ key: "title", label: "Tiêu đề" }, { key: "image_url", label: "Ảnh" }, { key: "is_active", label: "Hoạt động" }, { key: "start_at", label: "Bắt đầu" }, { key: "end_at", label: "Kết thúc" }],
    videos: [{ key: "title", label: "Tiêu đề" }, { key: "platform", label: "Nền tảng" }, { key: "video_url", label: "URL" }, { key: "is_active", label: "Hoạt động" }],
    "social-links": [{ key: "platform", label: "Nền tảng" }, { key: "name", label: "Tên" }, { key: "url", label: "URL" }, { key: "is_active", label: "Hoạt động" }],
    "blog/categories": [{ key: "name", label: "Tên" }, { key: "slug", label: "Slug" }, { key: "status", label: "Trạng thái" }],
    "blog/posts": [{ key: "title", label: "Tiêu đề" }, { key: "slug", label: "Slug" }, { key: "status", label: "Trạng thái" }, { key: "published_at", label: "Xuất bản" }],
    settings: [],
  };
  return sets[key];
}

function formatCell(key: string, value: unknown): string {
  if (key.includes("amount") || key === "starting_price" || key === "discount_value") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(numeric) : "—";
  }
  if (key.endsWith("_at") && value) {
    const date = new Date(String(value));
    return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
  }
  return displayValue(value);
}

function formatResourceCell(row: AdminRecord, key: string): string {
  if (key === "discount_value" && row.discount_type === "PERCENTAGE") {
    return `${displayValue(row.discount_value)}%`;
  }
  return formatCell(key, recordValue(row, key));
}

function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStats(await api.admin.dashboardStats());
    } catch (cause) {
      setError(safeMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <section className="admin-dashboard">
    <p className="admin-eyebrow">Bảng điều khiển</p>
    <h1>Quản trị cửa hàng</h1>
    <p className="admin-muted">Số liệu được tổng hợp từ dữ liệu hiện có trên máy chủ. Doanh thu là giá trị đơn hàng không bị hủy, không đại diện cho khoản tiền đã thu.</p>
    {error ? <div className="admin-state admin-state--error" role="alert"><p>{error}</p><button className="admin-button" onClick={() => void load()}>Thử lại</button></div>
      : loading ? <div className="admin-state"><Loading label="Đang tải số liệu…" /></div>
        : stats && <>
          <div className="admin-metrics-grid">
            <article className="admin-metric-card"><span>Tổng đơn hàng</span><strong>{stats.totalOrders.toLocaleString("vi-VN")}</strong></article>
            <article className="admin-metric-card"><span>Đơn chờ xác nhận</span><strong>{stats.pendingOrders.toLocaleString("vi-VN")}</strong></article>
            <article className="admin-metric-card"><span>Giá trị đơn không bị hủy</span><strong>{formatCell("total_amount", stats.revenue)}</strong></article>
            <article className="admin-metric-card"><span>Sản phẩm</span><strong>{stats.totalProducts.toLocaleString("vi-VN")}</strong></article>
            <article className="admin-metric-card"><span>Tài khoản khách hàng</span><strong>{stats.totalCustomers.toLocaleString("vi-VN")}</strong></article>
            <article className="admin-metric-card"><span>Phiên bản sắp hết hàng</span><strong>{stats.lowStockVariants.toLocaleString("vi-VN")}</strong><small>Tồn khả dụng ≤ {stats.lowStockThreshold}</small></article>
          </div>
          <div className="admin-dashboard-recent-grid">
            <section className="admin-detail-card"><div className="admin-section-heading"><h2>Đơn hàng gần đây</h2><Link href="/admin/orders">Xem tất cả</Link></div>
              {stats.recentOrders.length ? <div className="admin-recent-list">{stats.recentOrders.map((order) => <Link href={`/admin/orders/${order.id}`} key={order.id}>
                <span><strong>{order.order_code}</strong><small>{order.customer_name} · {formatCell("created_at", order.created_at)}</small></span><span><strong>{formatCell("total_amount", order.total_amount)}</strong><small>{order.status}</small></span>
              </Link>)}</div> : <p className="admin-muted">Chưa có đơn hàng.</p>}
            </section>
            <section className="admin-detail-card"><div className="admin-section-heading"><h2>Đánh giá gần đây</h2><Link href="/admin/reviews">Kiểm duyệt</Link></div>
              {stats.recentReviews.length ? <div className="admin-recent-list">{stats.recentReviews.map((review) => <div key={review.id}>
                <span><strong>{review.product_name} · {review.rating}/5</strong><small>{review.customer_name || "Khách chưa xác định"} · {formatCell("created_at", review.created_at)}</small><small>{review.comment || "Không có nội dung"}</small></span><span className="admin-status">{review.status}</span>
              </div>)}</div> : <p className="admin-muted">Chưa có đánh giá.</p>}
            </section>
          </div>
        </>}
    <div className="admin-dashboard-grid">{navGroups.flatMap((group) => group.links).map((link) => <Link className="admin-dashboard-card" href={`/admin/${link.key}`} key={link.key}>
      <span>{link.label}</span><strong>Quản lý dữ liệu</strong><span aria-hidden="true">→</span>
    </Link>)}</div>
  </section>;
}

function InventoryPage({ page, onPage, reload }: { page: number; onPage: (page: number) => void; reload: number }) {
  const [data, setData] = useState<AdminRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await api.admin.list("inventory", { page, limit: 20 });
      setData(result.data); setMeta(result.meta);
      setQuantities(Object.fromEntries(result.data.map((row) => [String(row.variant_id), String(row.quantity ?? "")])));
    } catch (cause) { setError(safeMessage(cause)); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { void load(); }, [load, reload]);
  async function save(row: AdminRecord) {
    const variantId = Number(row.variant_id);
    const quantity = Number(quantities[String(variantId)]);
    if (!Number.isInteger(quantity) || quantity < Number(row.reserved_quantity)) {
      setNotice("Tồn kho phải là số nguyên và không thấp hơn số lượng đã giữ.");
      return;
    }
    setBusy(variantId); setNotice("");
    try { await api.admin.setInventory(variantId, quantity); setNotice("Đã cập nhật tồn kho."); await load(); }
    catch (cause) { setNotice(safeMessage(cause)); }
    finally { setBusy(null); }
  }
  return <AdminListFrame title="Kho hàng" description="Điều chỉnh số lượng tồn. Giá trị không được thấp hơn số lượng đang giữ." loading={loading} error={error} retry={() => void load()} empty={data.length === 0} emptyText="Chưa có bản ghi kho hàng.">
    {notice && <p className="admin-inline-notice" role="status">{notice}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{resourceColumns("inventory").map((column) => <th key={column.key}>{column.label}</th>)}<th>Điều chỉnh</th></tr></thead>
      <tbody>{data.map((row) => <tr key={String(row.variant_id)}>{resourceColumns("inventory").map((column) => <td key={column.key}>{formatCell(column.key, recordValue(row, column.key))}</td>)}
        <td><div className="admin-inline-edit"><input aria-label={`Tồn kho ${displayValue(row.variant_name)}`} type="number" min={String(row.reserved_quantity ?? 0)} step="1" value={quantities[String(row.variant_id)] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [String(row.variant_id)]: event.target.value }))} /><button className="admin-button admin-button--small" disabled={busy === Number(row.variant_id)} onClick={() => void save(row)}>{busy === Number(row.variant_id) ? "…" : "Lưu"}</button></div></td>
      </tr>)}</tbody></table></div>
    <Pagination page={meta.page} limit={meta.limit} total={meta.total} onChange={onPage} />
  </AdminListFrame>;
}

function AdminListFrame({
  title, description, loading, error, retry, empty, emptyText, children,
}: {
  title: string; description?: string; loading: boolean; error: string; retry: () => void; empty: boolean; emptyText: string; children: React.ReactNode;
}) {
  return <section className="admin-list-page">
    <header className="admin-page-heading"><div><p className="admin-eyebrow">Quản lý</p><h1>{title}</h1>{description && <p>{description}</p>}</div></header>
    {error ? <div className="admin-state admin-state--error" role="alert"><p>{error}</p><button className="admin-button" onClick={retry}>Thử lại</button></div>
      : loading ? <div className="admin-state"><Loading label="Đang tải dữ liệu…" /></div>
        : empty ? <div className="admin-state"><EmptyState title="Chưa có dữ liệu" description={emptyText} /></div>
          : children}
  </section>;
}

function AdminResourceList({ resource, page, onPage, reload, onReload }: {
  resource: ResourceKey; page: number; onPage: (page: number) => void; reload: number; onReload: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [reviewStatus, setReviewStatus] = useState("");
  const [editor, setEditor] = useState<{ row?: AdminRecord } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const columns = useMemo(() => resourceColumns(resource), [resource]);
  const supportsSearch = resource === "products";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = {
        page,
        limit: 20,
        ...(supportsSearch && search.trim() ? { search: search.trim() } : {}),
        ...(resource === "products" && productCategory.trim() ? { category: productCategory.trim() } : {}),
        ...(resource === "products" ? { sort } : {}),
        ...(resource === "reviews" && reviewStatus ? { status: reviewStatus } : {}),
      };
      const result = await api.admin.list(resource, query);
      setRows(result.data); setMeta(result.meta);
    } catch (cause) { setError(safeMessage(cause)); }
    finally { setLoading(false); }
  }, [page, resource, reviewStatus, search, sort, supportsSearch, productCategory]);
  useEffect(() => { void load(); }, [load, reload]);

  const locallyFiltered = supportsSearch ? rows : search.trim()
    ? rows.filter((row) => columns.some((column) => String(recordValue(row, column.key) ?? "").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
    : rows;
  const editable = Boolean(fieldSets[resource]);
  const canCreate = editable && resource !== "users";
  const labels: Partial<Record<ResourceKey, string>> = {
    "blog/categories": "Tạo danh mục bài viết", "blog/posts": "Tạo bài viết", "social-links": "Tạo liên kết",
  };

  async function save(payload: AdminRecord) {
    setBusy(true); setNotice("");
    try {
      if (editor?.row) await api.admin.update(resource, rowId(editor.row), payload);
      else await api.admin.create(resource, payload);
      setEditor(null); setNotice("Đã lưu thay đổi."); onReload();
    } catch (cause) {
      setNotice(safeMessage(cause));
      throw cause;
    } finally { setBusy(false); }
  }

  async function remove(row: AdminRecord) {
    const name = String(row.name ?? row.title ?? row.code ?? row.slug ?? row.id);
    if (!window.confirm(`Xác nhận ngừng hoạt động hoặc lưu trữ “${name}”?`)) return;
    try { await api.admin.remove(resource, rowId(row)); setNotice("Đã cập nhật trạng thái bản ghi."); onReload(); }
    catch (cause) { setNotice(safeMessage(cause)); }
  }

  async function changeReview(row: AdminRecord, status: string) {
    if (["REJECTED", "HIDDEN"].includes(status) && !window.confirm(`Xác nhận chuyển đánh giá #${rowId(row)} sang ${status}?`)) return;
    try { await api.admin.setReviewStatus(rowId(row), status); setNotice("Đã cập nhật trạng thái đánh giá."); onReload(); }
    catch (cause) { setNotice(safeMessage(cause)); }
  }

  function openDetail(row: AdminRecord) {
    const id = rowId(row);
    router.push(`/admin/${resource}/${id}`);
  }

  return <AdminListFrame title={resourceLabels[resource]} description={`Dữ liệu phân trang theo máy chủ (${meta.total} bản ghi).`}
    loading={loading} error={error} retry={() => void load()} empty={locallyFiltered.length === 0}
    emptyText={search ? "Không có kết quả trên trang hiện tại." : "Chưa có bản ghi."}>
    <div className="admin-toolbar">
      <label className="admin-search"><span>{supportsSearch ? "Tìm trên toàn bộ sản phẩm" : "Lọc trong trang hiện tại"}</span>
        <input type="search" value={search} placeholder={supportsSearch ? "Tên hoặc slug" : "Nhập từ khóa"}
          onChange={(event) => { setSearch(event.target.value); onPage(1); }} /></label>
      {resource === "products" && <label className="admin-filter"><span>Sắp xếp</span><select value={sort} onChange={(event) => { setSort(event.target.value); onPage(1); }}>
        <option value="newest">Mới nhất</option><option value="name_asc">Tên A–Z</option><option value="price_asc">Giá tăng dần</option><option value="price_desc">Giá giảm dần</option>
      </select></label>}
      {resource === "products" && <label className="admin-filter"><span>Slug danh mục</span><input value={productCategory} onChange={(event) => { setProductCategory(event.target.value); onPage(1); }} placeholder="Ví dụ: nuoc-mam" /></label>}
      {resource === "reviews" && <label className="admin-filter"><span>Trạng thái đánh giá</span><select value={reviewStatus} onChange={(event) => { setReviewStatus(event.target.value); onPage(1); }}>
        <option value="">Tất cả trạng thái</option>{["PENDING", "APPROVED", "REJECTED", "HIDDEN"].map((value) => <option key={value}>{value}</option>)}
      </select></label>}
      {resource === "orders" && (
        <button
          type="button"
          className="admin-button"
          onClick={() => exportOrdersCsv(locallyFiltered)}
          title="Xuất dữ liệu đơn hàng ra file Excel (CSV UTF-8)"
        >
          📥 Xuất Excel (CSV)
        </button>
      )}
      {canCreate && <button className="admin-button admin-button--primary" onClick={() => setEditor({})}>{labels[resource] ?? `Tạo ${resourceLabels[resource].toLocaleLowerCase()}`}</button>}
    </div>
    {supportsSearch && <p className="admin-help">Tìm kiếm được gửi tới API. Các bộ lọc khác chỉ áp dụng cho dữ liệu của trang đang xem.</p>}
    {!supportsSearch && search && <p className="admin-help">Bộ lọc chỉ xét {rows.length} bản ghi đã tải của trang {page}; máy chủ không hỗ trợ tìm kiếm cho khu vực này.</p>}
    {notice && <p className="admin-inline-notice" role="status">{notice}</p>}
    {locallyFiltered.length === 0 ? <div className="admin-state"><EmptyState title="Không tìm thấy dữ liệu" description={search ? "Thử từ khóa khác hoặc chuyển trang." : "Chưa có bản ghi."} /></div> :
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Thao tác</th></tr></thead>
        <tbody>{locallyFiltered.map((row) => <tr key={String(row.id)}>{columns.map((column) => {
          const value = recordValue(row, column.key);
          const isStatus = column.key === "status" || column.key === "is_active";
          return <td key={column.key}>{isStatus
            ? <span className={`admin-status ${statusTone(value)}`}>{column.key === "is_active" ? (value === true || value === 1 ? "ACTIVE" : "INACTIVE") : displayValue(value)}</span>
            : column.key === "image_url" || column.key === "thumbnail_url" || column.key === "video_url" || column.key === "url"
              ? <span className="admin-truncate" title={String(value ?? "")}>{displayValue(value)}</span>
              : formatResourceCell(row, column.key)}</td>;
        })}<td><div className="admin-row-actions">
          {resource === "products" || resource === "orders" || resource === "users"
            ? <button className="admin-link-button" onClick={() => openDetail(row)}>{resource === "products" ? "Mở sản phẩm" : resource === "orders" ? "Chi tiết" : "Mở tài khoản"}</button>
            : resource === "reviews" ? <select aria-label={`Trạng thái đánh giá ${displayValue(row.id)}`} value={String(row.status)} onChange={(event) => void changeReview(row, event.target.value)}>
              {["PENDING", "APPROVED", "REJECTED", "HIDDEN"].map((value) => <option key={value}>{value}</option>)}
            </select>
              : editable ? <button className="admin-link-button" onClick={() => setEditor({ row })}>Sửa</button> : null}
          {editable && resource !== "products" && resource !== "users" && <button className="admin-link-button admin-link-button--danger" onClick={() => void remove(row)}>Ngừng / lưu trữ</button>}
        </div></td></tr>)}</tbody></table></div>}
    {search && !supportsSearch && <p className="admin-help">Kết quả lọc trên trang: {locallyFiltered.length} / {rows.length}.</p>}
    <Pagination page={meta.page} limit={meta.limit} total={meta.total} onChange={onPage} />
    {editor && fieldSets[resource] && <div className="admin-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
      <div className="admin-modal__panel" role="dialog" aria-modal="true" aria-label={resourceLabels[resource]}>
        <ResourceForm fields={fieldSets[resource]!} initial={editor.row} title={editor.row ? `Sửa ${resourceLabels[resource]}` : (labels[resource] ?? `Tạo ${resourceLabels[resource].toLocaleLowerCase()}`)}
          onCancel={() => setEditor(null)} onSave={save} busy={busy} />
      </div></div>}
  </AdminListFrame>;
}

function ProductDetail({ id, onBack, onRefresh }: { id: number; onBack: () => void; onRefresh: () => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<"product" | "variant" | "image" | null>(null);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [editingImage, setEditingImage] = useState<ProductImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setProduct(await api.admin.product(id)); }
    catch (cause) { setError(safeMessage(cause)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const variantFields: Field[] = [
    { name: "sku", label: "SKU", required: true }, { name: "name", label: "Tên phiên bản", required: true },
    { name: "volume", label: "Dung tích", type: "number", step: "0.001", nullable: true },
    { name: "unit", label: "Đơn vị", nullable: true }, { name: "price", label: "Giá bán", type: "number", step: "0.01", required: true },
    { name: "compare_price", label: "Giá so sánh", type: "number", step: "0.01", nullable: true },
    { name: "status", label: "Trạng thái", type: "select", options: statusOptions(["ACTIVE", "INACTIVE", "ARCHIVED"]) },
  ];
  const imageFields: Field[] = [
    { name: "image_url", label: "URL ảnh", type: "url", required: true },
    { name: "alt_text", label: "Mô tả ảnh", nullable: true },
    { name: "is_primary", label: "Ảnh chính", type: "checkbox" },
    { name: "sort_order", label: "Thứ tự", type: "number", step: "1", required: true },
  ];

  async function saveProduct(payload: AdminRecord) {
    setBusy(true);
    try { await api.admin.update("products", id, payload); setEditor(null); setNotice("Đã lưu sản phẩm."); await load(); onRefresh(); }
    catch (cause) { throw cause; }
    finally { setBusy(false); }
  }
  async function archiveProduct() {
    if (!window.confirm(`Lưu trữ sản phẩm “${product?.name ?? id}”?`)) return;
    try {
      await api.admin.remove("products", id);
      onBack();
      onRefresh();
    } catch (cause) {
      setNotice(safeMessage(cause));
    }
  }
  async function saveVariant(payload: AdminRecord) {
    if (!product) return;
    setBusy(true);
    try {
      if (editingVariant) await api.admin.updateVariant(editingVariant.id, payload);
      else await api.admin.addVariant(id, payload);
      setEditor(null); setEditingVariant(null); setNotice("Đã lưu phiên bản."); await load();
    } finally { setBusy(false); }
  }
  async function saveImage(payload: AdminRecord) {
    if (!product) return;
    setBusy(true);
    try {
      if (editingImage) await api.admin.updateImage(editingImage.id, payload);
      else await api.admin.addImage(id, payload);
      setEditor(null); setEditingImage(null); setNotice("Đã lưu hình ảnh."); await load();
    } finally { setBusy(false); }
  }
  async function removeVariant(variant: ProductVariant) {
    if (!window.confirm(`Ngừng phiên bản “${variant.name}” (${variant.sku})?`)) return;
    try { await api.admin.removeVariant(variant.id); setNotice("Đã ngừng phiên bản."); await load(); }
    catch (cause) { setNotice(safeMessage(cause)); }
  }
  async function removeImage(image: ProductImage) {
    if (!window.confirm("Xóa hình ảnh này khỏi sản phẩm?")) return;
    try { await api.admin.removeImage(image.id); setNotice("Đã xóa hình ảnh."); await load(); }
    catch (cause) { setNotice(safeMessage(cause)); }
  }
  async function setPrimary(image: ProductImage) {
    try { await api.admin.setPrimaryImage(image.id); setNotice("Đã đặt ảnh chính."); await load(); }
    catch (cause) { setNotice(safeMessage(cause)); }
  }

  if (loading) return <div className="admin-state"><Loading label="Đang tải chi tiết sản phẩm…" /></div>;
  if (error || !product) return <div className="admin-state admin-state--error" role="alert"><p>{error || "Không tìm thấy sản phẩm."}</p><button className="admin-button" onClick={() => void load()}>Thử lại</button></div>;
  return <section className="admin-detail-page">
    <button className="admin-link-button" onClick={onBack}>← Danh sách sản phẩm</button>
    <header className="admin-page-heading"><div><p className="admin-eyebrow">Sản phẩm #{product.id}</p><h1>{product.name}</h1><p>{product.slug} · {product.status}</p></div>
      <div className="admin-row-actions"><button className="admin-button admin-button--primary" onClick={() => setEditor("product")}>Sửa thông tin</button><button className="admin-button" onClick={() => void archiveProduct()}>Lưu trữ</button></div></header>
    {notice && <p className="admin-inline-notice" role="status">{notice}</p>}
    <section className="admin-detail-card"><div className="admin-section-heading"><div><h2>Phiên bản sản phẩm</h2><p>Thêm, sửa hoặc ngừng bán các phiên bản.</p></div><button className="admin-button admin-button--primary" onClick={() => { setEditingVariant(null); setEditor("variant"); }}>Thêm phiên bản</button></div>
      {!product.variants?.length ? <p className="admin-muted">Chưa có phiên bản.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>SKU</th><th>Tên</th><th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{product.variants.map((variant) => <tr key={variant.id}><td>{variant.sku}</td><td>{variant.name}</td><td>{formatCell("starting_price", variant.price)}</td><td>{variant.available_quantity ?? "—"}</td><td>{variant.status}</td><td><div className="admin-row-actions"><button className="admin-link-button" onClick={() => { setEditingVariant(variant); setEditor("variant"); }}>Sửa</button><button className="admin-link-button admin-link-button--danger" onClick={() => void removeVariant(variant)}>Ngừng</button></div></td></tr>)}</tbody></table></div>}
    </section>
    <section className="admin-detail-card"><div className="admin-section-heading"><div><h2>Hình ảnh</h2><p>Chỉ lưu URL ảnh đã được cửa hàng xác nhận.</p></div><button className="admin-button admin-button--primary" onClick={() => { setEditingImage(null); setEditor("image"); }}>Thêm ảnh</button></div>
      {!product.images?.length ? <p className="admin-muted">Chưa có hình ảnh.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Đường dẫn</th><th>Mô tả</th><th>Ảnh chính</th><th>Thứ tự</th><th>Thao tác</th></tr></thead><tbody>{product.images.map((image) => <tr key={image.id}><td><span className="admin-truncate">{image.image_url}</span></td><td>{image.alt_text || "—"}</td><td>{image.is_primary ? "Có" : "Không"}</td><td>{image.sort_order}</td><td><div className="admin-row-actions"><button className="admin-link-button" onClick={() => { setEditingImage(image); setEditor("image"); }}>Sửa</button>{!image.is_primary && <button className="admin-link-button" onClick={() => void setPrimary(image)}>Đặt ảnh chính</button>}<button className="admin-link-button admin-link-button--danger" onClick={() => void removeImage(image)}>Xóa</button></div></td></tr>)}</tbody></table></div>}
    </section>
    {editor && <div className="admin-modal"><div className="admin-modal__panel" role="dialog" aria-modal="true" aria-label="Sửa dữ liệu sản phẩm">
      <ResourceForm
        title={editor === "product" ? "Sửa sản phẩm" : editor === "variant" ? (editingVariant ? "Sửa phiên bản" : "Thêm phiên bản") : (editingImage ? "Sửa hình ảnh" : "Thêm hình ảnh")}
        fields={editor === "product" ? fieldSets.products! : editor === "variant" ? variantFields : imageFields}
        initial={editor === "product" ? product as unknown as AdminRecord : editor === "variant" ? editingVariant as unknown as AdminRecord | undefined : editingImage as unknown as AdminRecord | undefined}
        onCancel={() => { setEditor(null); setEditingVariant(null); setEditingImage(null); }}
        onSave={editor === "product" ? saveProduct : editor === "variant" ? saveVariant : saveImage}
        busy={busy}
      />
    </div></div>}
  </section>;
}

function exportOrdersCsv(records: AdminRecord[]) {
  if (!records.length) {
    alert("Không có đơn hàng nào để xuất.");
    return;
  }
  const headers = [
    "Mã đơn hàng",
    "Ngày tạo",
    "Khách hàng",
    "Số điện thoại",
    "Tổng tiền (VNĐ)",
    "Trạng thái đơn",
    "Phương thức thanh toán",
    "Trạng thái thanh toán",
  ];

  const rows = records.map((r) => [
    `"${String(r.order_code ?? "").replace(/"/g, '""')}"`,
    `"${String(r.created_at ?? "").replace(/"/g, '""')}"`,
    `"${String(r.customer_name ?? "").replace(/"/g, '""')}"`,
    `"${String(r.customer_phone ?? "").replace(/"/g, '""')}"`,
    `"${Number(r.total_amount ?? 0)}"`,
    `"${String(r.status ?? "").replace(/"/g, '""')}"`,
    `"${String(r.payment_method ?? "").replace(/"/g, '""')}"`,
    `"${String(r.payment_status ?? "").replace(/"/g, '""')}"`,
  ]);

  // Prepend UTF-8 BOM so Microsoft Excel renders Vietnamese characters correctly
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute("download", `Don-hang-Huong-Lang-Co-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ShippingInvoiceModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const isCod = order.payments?.[0]?.payment_method === "COD";
  const isPaid = order.payments?.[0]?.payment_status === "PAID" || order.status === "CONFIRMED";
  const amountToCollect = isCod && !isPaid ? Number(order.total_amount) : 0;
  const address = [order.shipping_address_line, order.shipping_ward, order.shipping_district, order.shipping_province]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="admin-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal__panel"
        style={{ maxWidth: "780px", width: "95%", background: "#fff", padding: "24px", color: "#28251E" }}
        role="dialog"
        aria-label="Phiếu giao hàng"
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}
          className="no-print"
        >
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Xem trước Phiếu giao hàng</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="admin-button admin-button--primary" onClick={() => window.print()}>
              🖨️ In phiếu ngay
            </button>
            <button type="button" className="admin-button admin-button--quiet" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        {/* Printable Section */}
        <div
          id="printable-shipping-invoice"
          style={{
            border: "2px solid #28251E",
            padding: "20px",
            color: "#111",
            background: "#fff",
            fontFamily: "Arial, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid #8B3A1A",
              paddingBottom: "12px",
              marginBottom: "14px",
            }}
          >
            <div>
              <h1
                style={{
                  margin: "0 0 4px",
                  fontSize: "17px",
                  color: "#8B3A1A",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontWeight: "bold",
                }}
              >
                NƯỚC MẮM NAM Ô — HƯƠNG LÀNG CỔ
              </h1>
              <p style={{ margin: "2px 0", fontSize: "11px", color: "#555" }}>
                Đặc sản truyền thống tiến vua hơn 400 năm · Chuẩn OCOP 4 sao & HACCP
              </p>
              <p style={{ margin: "2px 0", fontSize: "11px" }}>
                Địa chỉ xưởng: Kiệt 884/74/4 Nguyễn Lương Bằng, P. Hòa Hiệp Nam, Q. Liên Chiểu, TP. Đà Nẵng
              </p>
              <p style={{ margin: "2px 0", fontSize: "11px" }}>
                Hotline / Zalo: <strong>0935 998 908</strong> · Email: huonglangco.namo@gmail.com
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11.5px", color: "#666" }}>MÃ ĐƠN HÀNG</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#8B3A1A", letterSpacing: "1px" }}>
                {order.order_code}
              </div>
              <div style={{ fontSize: "11px", color: "#777", marginTop: "2px" }}>
                {new Date(order.created_at).toLocaleString("vi-VN")}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "10px 0 16px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "16px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#28251E",
              }}
            >
              PHIẾU GIAO HÀNG & THU TIỀN
            </h2>
          </div>

          {/* Sender & Receiver Boxes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              marginBottom: "14px",
              fontSize: "12px",
            }}
          >
            <div style={{ border: "1px solid #ccc", padding: "10px", borderRadius: "4px" }}>
              <div
                style={{
                  fontWeight: "bold",
                  color: "#8B3A1A",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  fontSize: "11px",
                }}
              >
                1. Người gửi:
              </div>
              <div>
                <strong>Nước mắm Nam Ô Hương Làng Cổ</strong>
              </div>
              <div>SĐT: 0935 998 908</div>
              <div>Tổ 97 (Nam Ô 2), Hòa Hiệp Nam, Liên Chiểu, Đà Nẵng</div>
            </div>

            <div
              style={{
                border: "2px solid #8B3A1A",
                padding: "10px",
                borderRadius: "4px",
                background: "#FAF8F4",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  color: "#8B3A1A",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  fontSize: "11px",
                }}
              >
                2. Người nhận:
              </div>
              <div style={{ fontSize: "14px", fontWeight: "bold" }}>{order.customer_name}</div>
              <div style={{ fontSize: "13px", fontWeight: "bold", color: "#8B3A1A", margin: "2px 0" }}>
                SĐT: {order.customer_phone}
              </div>
              <div style={{ lineHeight: "1.4" }}>Địa chỉ: {address}</div>
              {order.note && <div style={{ color: "#C0392B", marginTop: "4px" }}>Ghi chú: {order.note}</div>}
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", marginBottom: "14px" }}>
            <thead>
              <tr style={{ background: "#F5F2EB", borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "6px 8px", textAlign: "left" }}>STT</th>
                <th style={{ padding: "6px 8px", textAlign: "left" }}>Tên sản phẩm & Quy cách</th>
                <th style={{ padding: "6px 8px", textAlign: "center", width: "50px" }}>SL</th>
                <th style={{ padding: "6px 8px", textAlign: "right", width: "95px" }}>Đơn giá</th>
                <th style={{ padding: "6px 8px", textAlign: "right", width: "105px" }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, index) => (
                <tr key={index} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "6px 8px" }}>{index + 1}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <strong>{item.product_name}</strong> - {item.variant_name}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {new Intl.NumberFormat("vi-VN").format(Number(item.unit_price))} ₫
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>
                    {new Intl.NumberFormat("vi-VN").format(Number(item.subtotal))} ₫
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Collection Box */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: "14px",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                border: "2px solid #28251E",
                padding: "10px",
                textAlign: "center",
                borderRadius: "4px",
                background: amountToCollect > 0 ? "#FFF8E1" : "#E8F5E9",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "#555" }}>
                TIỀN THU NGƯỜI NHẬN (SHIPPER THU):
              </div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: "900",
                  color: amountToCollect > 0 ? "#C0392B" : "#1B5E20",
                  margin: "4px 0",
                }}
              >
                {amountToCollect > 0 ? `${new Intl.NumberFormat("vi-VN").format(amountToCollect)} ₫` : "0 ₫ (ĐÃ THANH TOÁN)"}
              </div>
              <div style={{ fontSize: "10.5px", color: "#666" }}>
                Hình thức:{" "}
                {order.payments?.[0]?.payment_method === "COD"
                  ? "Thanh toán khi nhận hàng (COD)"
                  : "Chuyển khoản VietQR / Trực tuyến"}
              </div>
            </div>

            <div style={{ fontSize: "11.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                <span>Tiền hàng:</span>
                <span>{new Intl.NumberFormat("vi-VN").format(Number(order.subtotal))} ₫</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                <span>Phí vận chuyển:</span>
                <span>{new Intl.NumberFormat("vi-VN").format(Number(order.shipping_fee))} ₫</span>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between", margin: "2px 0", color: "#1B5E20" }}
                >
                  <span>Giảm giá ({order.coupon_code || "Ưu đãi"}):</span>
                  <span>-{new Intl.NumberFormat("vi-VN").format(Number(order.discount_amount))} ₫</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  margin: "4px 0 0",
                  paddingTop: "4px",
                  borderTop: "1px solid #ddd",
                  fontWeight: "bold",
                }}
              >
                <span>Tổng giá trị đơn:</span>
                <span style={{ color: "#8B3A1A" }}>
                  {new Intl.NumberFormat("vi-VN").format(Number(order.total_amount))} ₫
                </span>
              </div>
            </div>
          </div>

          {/* Signature Box */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              textAlign: "center",
              fontSize: "11px",
              marginTop: "20px",
              paddingTop: "10px",
              borderTop: "1px dashed #ccc",
            }}
          >
            <div>
              <strong>Người gửi hàng</strong>
              <div style={{ height: "45px" }} />
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
            <div>
              <strong>Nhân viên giao nhận</strong>
              <div style={{ height: "45px" }} />
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
            <div>
              <strong>Người nhận hàng</strong>
              <div style={{ height: "45px" }} />
              <span>(Đã kiểm tra hàng nguyên vẹn)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [printModal, setPrintModal] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const value = await api.admin.order(id); setOrder(value); setStatus(value.status); }
    catch (cause) { setError(safeMessage(cause)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  async function saveStatus() {
    if (!order || status === order.status) return;
    if (!window.confirm(`Chuyển trạng thái đơn ${order.order_code} sang ${status}?`)) return;
    setBusy(true);
    try { await api.admin.setOrderStatus(id, status); setNotice("Đã cập nhật trạng thái đơn."); await load(); }
    catch (cause) { setNotice(safeMessage(cause)); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="admin-state"><Loading label="Đang tải chi tiết đơn hàng…" /></div>;
  if (error || !order) return <div className="admin-state admin-state--error" role="alert"><p>{error || "Không tìm thấy đơn hàng."}</p><button className="admin-button" onClick={() => void load()}>Thử lại</button></div>;
  const allowedTransitions: Record<string, string[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED", "RETURNED"],
    DELIVERED: ["RETURNED"],
    CANCELLED: [],
    RETURNED: [],
  };
  const statuses = [order.status, ...(allowedTransitions[order.status] ?? [])];
  return <section className="admin-detail-page">
    <button className="admin-link-button" onClick={onBack}>← Danh sách đơn hàng</button>
    <header className="admin-page-heading">
      <div>
        <p className="admin-eyebrow">Chi tiết đơn</p>
        <h1>{order.order_code}</h1>
        <p>{order.customer_name} · {formatCell("created_at", order.created_at)}</p>
      </div>
      <div className="admin-row-actions">
        <button
          type="button"
          className="admin-button admin-button--primary"
          onClick={() => setPrintModal(true)}
        >
          🖨️ In phiếu giao hàng
        </button>
      </div>
    </header>
    {notice && <p className="admin-inline-notice" role="status">{notice}</p>}
    <div className="admin-detail-grid">
      <section className="admin-detail-card"><h2>Thông tin nhận hàng</h2><p>{order.customer_name} · {order.customer_phone}</p><p>{[order.shipping_address_line, order.shipping_ward, order.shipping_district, order.shipping_province].filter(Boolean).join(", ")}</p>{order.note && <p>Ghi chú: {order.note}</p>}
        <h2>Sản phẩm</h2>{order.items?.length ? order.items.map((item, index) => <div className="admin-order-line" key={`${item.sku}-${index}`}><span>{item.product_name} · {item.variant_name} × {item.quantity}</span><strong>{formatCell("total_amount", item.subtotal)}</strong></div>) : <p>API không trả về dòng sản phẩm.</p>}</section>
      <section className="admin-detail-card"><h2>Tổng kết</h2><p>Tạm tính <strong>{formatCell("total_amount", order.subtotal)}</strong></p><p>Phí giao hàng <strong>{formatCell("total_amount", order.shipping_fee)}</strong></p><p>Giảm giá <strong>{formatCell("total_amount", order.discount_amount)}</strong></p><p className="admin-total">Tổng cộng <strong>{formatCell("total_amount", order.total_amount)}</strong></p><p>Thanh toán {order.payments?.[0]?.payment_method ?? "—"} · {order.payments?.[0]?.payment_status ?? "—"}</p>
        <label className="admin-form-field"><span>Trạng thái đơn</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><button className="admin-button admin-button--primary" disabled={busy || status === order.status} onClick={() => void saveStatus()}>{busy ? "Đang lưu…" : "Cập nhật trạng thái"}</button></section>
    </div>
    {printModal && <ShippingInvoiceModal order={order} onClose={() => setPrintModal(false)} />}
  </section>;
}

function UserDetail({ id, currentUser, onBack }: { id: number; currentUser: User | null; onBack: () => void }) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setUser(await api.admin.user(id)); }
    catch (cause) { setError(safeMessage(cause)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <div className="admin-state"><Loading label="Đang tải thông tin tài khoản…" /></div>;
  if (error || !user) return <div className="admin-state admin-state--error" role="alert"><p>{error || "Không tìm thấy tài khoản."}</p><button className="admin-button" onClick={() => void load()}>Thử lại</button></div>;
  const fields = fieldSets.users!;
  return <section className="admin-detail-page">
    <button className="admin-link-button" onClick={onBack}>← Danh sách tài khoản</button>
    <header className="admin-page-heading"><div><p className="admin-eyebrow">Tài khoản #{id}</p><h1>{displayValue(user.profile.full_name)}</h1><p>{displayValue(user.profile.email)} · {displayValue(user.profile.phone)}</p></div></header>
    {notice && <p className="admin-inline-notice" role="status">{notice}</p>}
    <div className="admin-detail-card admin-user-card"><ResourceForm title="Cập nhật quyền và trạng thái" fields={fields} initial={user.profile}
      onCancel={onBack} busy={busy} onSave={async (payload) => {
        if (String(id) === currentUser?.id && (payload.role !== "ADMIN" || payload.status !== "ACTIVE")) {
          setNotice("Không thể tự gỡ quyền quản trị hoặc khóa tài khoản đang sử dụng.");
          return;
        }
        setBusy(true);
        try { await api.admin.update("users", id, payload); setNotice("Đã cập nhật tài khoản."); await load(); }
        catch (cause) { setNotice(safeMessage(cause)); throw cause; }
        finally { setBusy(false); }
      }} /></div>
    <div className="admin-dashboard-recent-grid">
      <section className="admin-detail-card"><h2>Đơn hàng gần đây</h2>
        {user.orders.length ? <div className="admin-recent-list">{user.orders.map((order) => <Link href={`/admin/orders/${order.id}`} key={String(order.id)}>
          <span><strong>{displayValue(order.order_code)}</strong><small>{formatCell("created_at", order.created_at)}</small></span>
          <span><strong>{formatCell("total_amount", order.total_amount)}</strong><small>{displayValue(order.status)}</small></span>
        </Link>)}</div> : <p className="admin-muted">Tài khoản chưa có đơn hàng.</p>}
      </section>
      <section className="admin-detail-card"><h2>Đánh giá gần đây</h2>
        {user.reviews.length ? <div className="admin-recent-list">{user.reviews.map((review) => <div key={String(review.id)}>
          <span><strong>{displayValue(review.product_name)} · {displayValue(review.rating)}/5</strong><small>{formatCell("created_at", review.created_at)} · {displayValue(review.status)}</small><small>{displayValue(review.comment)}</small></span>
        </div>)}</div> : <p className="admin-muted">Tài khoản chưa có đánh giá.</p>}
      </section>
    </div>
  </section>;
}

function AdminSettingsPage() {
  const { refreshStoreSettings } = useStore();
  const [settings, setSettings] = useState<AdminStoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.admin.settings().then((result) => {
      if (active) setSettings(result);
    }).catch((cause) => {
      if (active) setError(safeMessage(cause));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [retry]);

  function text<K extends keyof AdminStoreSettings>(key: K, value: AdminStoreSettings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  function money(key: "shipping_fee" | "free_shipping_minimum", value: string) {
    text(key, value === "" ? null : Number(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.admin.updateSettings(settings);
      setSettings(updated);
      await refreshStoreSettings();
      setNotice("Đã lưu cài đặt cửa hàng.");
    } catch (cause) {
      setError(safeMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="admin-list-page"><Loading label="Đang tải cài đặt cửa hàng…" /></section>;
  if (!settings) return <section className="admin-list-page"><div className="admin-state admin-state--error" role="alert">
    <p>{error || "Không tải được cài đặt cửa hàng."}</p><button className="admin-button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button>
  </div></section>;

  return <section className="admin-list-page">
    <header className="admin-page-heading"><div><p className="admin-eyebrow">Hệ thống</p><h1>Cài đặt cửa hàng</h1>
      <p>Thông tin trống sẽ được ẩn trên website. Trạng thái đơn mới luôn bắt đầu ở PENDING; không thể xác nhận đơn tự động.</p></div></header>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    {notice && <p className="admin-inline-notice" role="status">{notice}</p>}
    <form className="admin-settings-form" onSubmit={(event) => void submit(event)} noValidate>
      <fieldset className="admin-detail-card">
        <legend>Thông tin cửa hàng</legend>
        <div className="admin-form__fields">
          <label className="admin-form-field"><span>Tên cửa hàng</span><input required value={settings.store_name} onChange={(event) => text("store_name", event.target.value)} /></label>
          <label className="admin-form-field"><span>Mô tả ngắn</span><textarea rows={3} value={settings.store_description ?? ""} onChange={(event) => text("store_description", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>Logo URL (không bắt buộc)</span><input type="url" value={settings.logo_url ?? ""} onChange={(event) => text("logo_url", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>Địa chỉ</span><input value={settings.store_address ?? ""} onChange={(event) => text("store_address", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>Số điện thoại</span><input type="tel" value={settings.contact_phone ?? ""} onChange={(event) => text("contact_phone", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>Email liên hệ</span><input type="email" value={settings.contact_email ?? ""} onChange={(event) => text("contact_email", event.target.value || null)} /></label>
        </div>
      </fieldset>
      <fieldset className="admin-detail-card">
        <legend>Giao hàng và đơn hàng</legend>
        <div className="admin-form__fields">
          <label className="admin-form-field"><span>Phí vận chuyển mặc định (₫)</span><input type="number" min="0" step="1000" value={settings.shipping_fee ?? ""} onChange={(event) => money("shipping_fee", event.target.value)} /></label>
          <label className="admin-form-field"><span>Mức đơn hàng miễn phí vận chuyển (₫)</span><input type="number" min="0" step="1000" disabled={!settings.free_shipping_enabled} value={settings.free_shipping_minimum ?? ""} onChange={(event) => money("free_shipping_minimum", event.target.value)} /></label>
          <label className="admin-checkbox"><input type="checkbox" checked={settings.free_shipping_enabled} onChange={(event) => text("free_shipping_enabled", event.target.checked)} /> Bật miễn phí vận chuyển theo mức đơn hàng</label>
          <div className="admin-settings-options">
            <strong>Cho phép khách hủy đơn khi đang ở trạng thái</strong>
            {(["PENDING", "CONFIRMED"] as const).map((status) => <label className="admin-checkbox" key={status}>
              <input type="checkbox" checked={settings.customer_cancellation_statuses.includes(status)} onChange={(event) => {
                const statuses = event.target.checked
                  ? [...settings.customer_cancellation_statuses, status]
                  : settings.customer_cancellation_statuses.filter((item) => item !== status);
                text("customer_cancellation_statuses", statuses);
              }} /> {status}
            </label>)}
          </div>
          <p className="admin-help">Trạng thái đơn mặc định là PENDING. Giới hạn số mặt hàng chưa được bật vì hiện không có quy tắc nghiệp vụ tương ứng.</p>
        </div>
      </fieldset>
      <fieldset className="admin-detail-card">
        <legend>Thanh toán và thông tin nhận chuyển khoản</legend>
        <div className="admin-form__fields">
          <label className="admin-checkbox"><input type="checkbox" checked={settings.cod_enabled} onChange={(event) => text("cod_enabled", event.target.checked)} /> Cho phép thanh toán khi nhận hàng (COD)</label>
          <label className="admin-checkbox"><input type="checkbox" checked={settings.bank_transfer_enabled} onChange={(event) => text("bank_transfer_enabled", event.target.checked)} /> Cho phép chuyển khoản ngân hàng</label>
          <label className="admin-form-field"><span>Tên ngân hàng</span><input value={settings.bank_name ?? ""} onChange={(event) => text("bank_name", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>Số tài khoản</span><input autoComplete="off" value={settings.bank_account_number ?? ""} onChange={(event) => text("bank_account_number", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>Chủ tài khoản</span><input autoComplete="off" value={settings.bank_account_holder ?? ""} onChange={(event) => text("bank_account_holder", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>Chi nhánh (không bắt buộc)</span><input value={settings.bank_branch ?? ""} onChange={(event) => text("bank_branch", event.target.value || null)} /></label>
          <p className="admin-help">Không nhập mật khẩu, mã PIN, mã CVV, API key hoặc thông tin bí mật. Thông tin tài khoản chỉ được trả về API công khai khi chuyển khoản được bật.</p>
        </div>
      </fieldset>
      <fieldset className="admin-detail-card">
        <legend>Liên hệ và mạng xã hội</legend>
        <div className="admin-form__fields">
          <label className="admin-form-field"><span>Facebook URL</span><input type="url" value={settings.facebook_url ?? ""} onChange={(event) => text("facebook_url", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>TikTok URL</span><input type="url" value={settings.tiktok_url ?? ""} onChange={(event) => text("tiktok_url", event.target.value || null)} /></label>
          <label className="admin-form-field"><span>YouTube URL</span><input type="url" value={settings.youtube_url ?? ""} onChange={(event) => text("youtube_url", event.target.value || null)} /></label>
        </div>
      </fieldset>
      <div className="admin-form__actions"><button className="admin-button admin-button--primary" type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu cài đặt"}</button></div>
    </form>
  </section>;
}

export function AdminApp({ section }: { section: string[] }) {
  const router = useRouter();
  const { user, authLoading, setUser } = useStore();
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const resolved = resolveResource(section);
  const current = resolved.key;
  const routePath = `/admin/${section.join("/")}`;
  const isDetail = Boolean(resolved.id && ["products", "orders", "users"].includes(String(section[0])));

  useEffect(() => { setPage(1); }, [current]);
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace(`/admin/login?next=${encodeURIComponent(routePath || "/admin")}`);
    else if (user.role !== "ADMIN") router.replace("/tai-khoan");
  }, [authLoading, routePath, router, user]);
  useEffect(() => {
    function accessDenied(event: Event) {
      const status = (event as CustomEvent<number>).detail;
      if (status === 401) {
        setUser(null);
        router.replace(`/admin/login?next=${encodeURIComponent(routePath || "/admin")}`);
      } else if (status === 403) {
        router.replace("/tai-khoan");
      }
    }
    window.addEventListener("admin-access-denied", accessDenied);
    return () => window.removeEventListener("admin-access-denied", accessDenied);
  }, [routePath, router, setUser]);

  async function logout() {
    try { await api.logout(); } finally { setUser(null); router.replace("/admin/login"); }
  }
  if (authLoading || !user || user.role !== "ADMIN") return <main className="admin-auth-loading"><Loading label={authLoading ? "Đang xác thực quyền truy cập…" : "Đang chuyển hướng…"} /></main>;

  const detailBackPath = section[0] === "products" ? "/admin/products" : section[0] === "orders" ? "/admin/orders" : "/admin/users";
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-sidebar-brand"><span className="admin-brand-mark" aria-hidden="true">A</span><span><strong>Quản trị</strong><small>Nam Ô Hương Làng Cổ</small></span></Link>
      <nav aria-label="Menu quản trị">
        <Link className={`admin-nav-link ${!current ? "is-active" : ""}`} href="/admin">Tổng quan</Link>
        {navGroups.map((group) => <div className="admin-nav-group" key={group.heading}><span>{group.heading}</span>
          {group.links.map((link) => <Link className={`admin-nav-link ${current === link.key ? "is-active" : ""}`} href={`/admin/${link.key}`} key={link.key}>{link.label}</Link>)}
        </div>)}
      </nav>
      <div className="admin-sidebar-footer"><span>{user.fullName}</span><button className="admin-nav-link" onClick={() => void logout()}>Đăng xuất</button><Link className="admin-nav-link" href="/">← Cửa hàng</Link></div>
    </aside>
    <main className="admin-main">
      <div className="admin-topbar"><span>{titleFor(current)}</span><span>{user.fullName} · ADMIN</span></div>
      <div className="admin-content">
        {isDetail && resolved.id ? section[0] === "products"
          ? <ProductDetail id={resolved.id} onBack={() => router.push(detailBackPath)} onRefresh={() => setReload((value) => value + 1)} />
          : section[0] === "orders" ? <OrderDetail id={resolved.id} onBack={() => router.push(detailBackPath)} />
            : <UserDetail id={resolved.id} currentUser={user} onBack={() => router.push(detailBackPath)} />
          : current === "settings" ? <AdminSettingsPage />
            : current === "inventory" ? <InventoryPage page={page} onPage={setPage} reload={reload} />
            : current ? <AdminResourceList resource={current} page={page} onPage={setPage} reload={reload} onReload={() => setReload((value) => value + 1)} />
              : <AdminDashboard />}
      </div>
    </main>
  </div>;
}
