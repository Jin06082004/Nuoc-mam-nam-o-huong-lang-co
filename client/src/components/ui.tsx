import Link from "next/link";
import type { ReactNode } from "react";

export function Button({
  children, href, variant = "primary", className = "", ...props
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = `button button--${variant} ${className}`.trim();
  if (href) return <Link className={classes} href={href}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="section-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {description && <p className="section-heading__description">{description}</p>}
    </div>
  );
}

export function Loading({ label = "Đang tải nội dung…" }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <span className="state-card__icon" aria-hidden="true">!</span>
      <h2>Chưa thể tải nội dung</h2>
      <p>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="state-card">
      <span className="state-card__icon" aria-hidden="true">⌂</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="breadcrumb" aria-label="Điều hướng breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 && <span className="breadcrumb__separator" aria-hidden="true">/</span>}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Pagination({
  page, limit, total, onChange,
}: { page: number; limit: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Phân trang">
      <button type="button" className="button button--quiet" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Trang trước
      </button>
      <span>Trang {page} / {pages}</span>
      <button type="button" className="button button--quiet" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Trang sau →
      </button>
    </nav>
  );
}

export function Price({ value, comparePrice }: { value: string | number | null | undefined; comparePrice?: string | number | null }) {
  const amount = value === null || value === undefined || value === "" ? null : Number(value);
  if (amount === null || !Number.isFinite(amount)) return <span className="price price--unknown">Giá đang được cập nhật</span>;
  const formatted = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  const compare = comparePrice === null || comparePrice === undefined ? null : Number(comparePrice);
  return (
    <span className="price">
      <strong>{formatted}</strong>
      {compare && Number.isFinite(compare) && compare > amount && (
        <del>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(compare)}</del>
      )}
    </span>
  );
}

export function Rating({ value, count }: { value: string | number | null | undefined; count?: number }) {
  const rating = value === null || value === undefined ? null : Number(value);
  if (!rating || !Number.isFinite(rating)) return <span className="rating rating--empty">Chưa có đánh giá</span>;
  return (
    <span className="rating" aria-label={`Đánh giá ${rating.toFixed(1)} trên 5`}>
      <span aria-hidden="true">★</span> {rating.toFixed(1)}{count !== undefined && <span className="rating__count">({count})</span>}
    </span>
  );
}

export function ProductImage({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  if (!src) {
    return <div className={`product-image product-image--placeholder ${className}`} role="img" aria-label={alt}>
      <span className="product-image__mark" aria-hidden="true">NÔ</span>
      <span>Ảnh sản phẩm sẽ được cập nhật</span>
    </div>;
  }
  return (
    <div className={`product-image ${className}`}>
      {/* Dynamic URLs are supplied by the API; unoptimized avoids imposing an unbounded remote-image allowlist. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
}
