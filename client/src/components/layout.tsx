"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "./providers";

const navigation = [
  { label: "Trang chủ", href: "/" },
  { label: "Sản phẩm", href: "/san-pham" },
  { label: "Câu chuyện", href: "/gioi-thieu" },
  { label: "Bài viết", href: "/blog" },
  { label: "Liên hệ", href: "/lien-he" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, cartCount, refreshUser, notify, storeSettings } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const storeName = storeSettings?.store_name.trim() || "Nước mắm Nam Ô Hương Làng Cổ";
  const logoUrl = storeSettings?.logo_url || "/images/logo.jpg";

  async function logout() {
    try {
      await api.logout();
      await refreshUser();
      notify("Bạn đã đăng xuất.");
      router.push("/");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Không thể đăng xuất.", "error");
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    router.push(value ? `/san-pham?search=${encodeURIComponent(value)}` : "/san-pham");
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      {storeSettings?.store_description && <div className="announcement">{storeSettings.store_description}</div>}
      <div className="site-header__main container">
        <Link href="/" className="brand" aria-label={`${storeName} - Trang chủ`}>
          <Image
            src={logoUrl}
            alt="Logo Nước mắm Nam Ô Hương Làng Cổ"
            width={52}
            height={52}
            className="brand__logo"
            unoptimized
            priority
          />
          <span className="brand__text"><strong>{storeName}</strong></span>
        </Link>
        <nav className={`main-nav ${menuOpen ? "main-nav--open" : ""}`} aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "is-active" : ""}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <form className="header-search header-search--mobile" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="mobile-search">Tìm sản phẩm</label>
            <input id="mobile-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm…" />
            <button type="submit" aria-label="Tìm kiếm">⌕</button>
          </form>
        </nav>
        <form className="header-search header-search--desktop" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="desktop-search">Tìm sản phẩm</label>
          <input id="desktop-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm…" />
          <button type="submit" aria-label="Tìm kiếm">⌕</button>
        </form>
        <div className="header-actions">
          <Link href={user ? "/tai-khoan" : "/dang-nhap"} className="header-action" aria-label={user ? "Tài khoản" : "Đăng nhập"}>
            <span aria-hidden="true">♙</span><span className="header-action__label">{user ? "Tài khoản" : "Đăng nhập"}</span>
          </Link>
          {user && <button type="button" className="header-action header-action--logout" onClick={logout}>Thoát</button>}
          <Link href="/gio-hang" className="header-action header-action--cart" aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}>
            <span aria-hidden="true">♧</span><span className="header-action__label">Giỏ hàng</span>
            <span className="cart-count">{cartCount}</span>
          </Link>
        </div>
        <button
          type="button"
          className="menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { storeSettings, storeSettingsLoading, storeSettingsError } = useStore();
  const socialLinks = [
    { name: "Facebook", url: storeSettings?.facebook_url },
    { name: "TikTok", url: storeSettings?.tiktok_url },
    { name: "YouTube", url: storeSettings?.youtube_url },
  ].filter((link): link is { name: string; url: string } => Boolean(link.url));
  const storeName = storeSettings?.store_name.trim() || "Nước mắm Nam Ô Hương Làng Cổ";
  const logoUrl = storeSettings?.logo_url || "/images/logo.jpg";

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link href="/" className="brand brand--footer" aria-label={`${storeName} - Trang chủ`}>
            <Image
              src={logoUrl}
              alt="Logo Nước mắm Nam Ô Hương Làng Cổ"
              width={52}
              height={52}
              className="brand__logo brand__logo--footer"
              unoptimized
            />
            <span className="brand__text"><strong>{storeName}</strong></span>
          </Link>
          {storeSettings?.store_description && <p>{storeSettings.store_description}</p>}
        </div>
        <div>
          <h2>Mua sắm</h2>
          <Link href="/san-pham">Tất cả sản phẩm</Link>
          <Link href="/gio-hang">Giỏ hàng</Link>
          <Link href="/tai-khoan/don-hang">Đơn hàng của tôi</Link>
        </div>
        <div>
          <h2>Khám phá</h2>
          <Link href="/gioi-thieu">Về thương hiệu</Link>
          <Link href="/blog">Bài viết di sản</Link>
          <Link href="/lien-he">Liên hệ & Thăm xưởng</Link>
        </div>
        <div>
          <h2>Chính sách</h2>
          <Link href="/chinh-sach-doi-tra">Chính sách đổi trả</Link>
          <Link href="/chinh-sach-bao-mat">Chính sách bảo mật</Link>
          <Link href="/dieu-khoan-dich-vu">Điều khoản dịch vụ</Link>
        </div>
        <div>
          <h2>Kết nối</h2>
          {storeSettings?.contact_phone && <a href={`tel:${storeSettings.contact_phone}`}>Hotline: {storeSettings.contact_phone}</a>}
          {storeSettings?.contact_email && <a href={`mailto:${storeSettings.contact_email}`}>Email: {storeSettings.contact_email}</a>}
          {storeSettings?.store_address && <span style={{ fontSize: "0.85rem", display: "block", marginTop: "4px" }}>{storeSettings.store_address}</span>}
          {storeSettingsError && <p className="footer-note">Chưa tải được thông tin cửa hàng.</p>}
          <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {socialLinks.map((link) => (
              <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer">{link.name} ↗</a>
            ))}
          </div>
          {!storeSettingsLoading && !storeSettingsError && socialLinks.length === 0 && <p className="footer-note">Chưa có liên kết mạng xã hội.</p>}
          {storeSettingsLoading && <span className="footer-note">Đang tải thông tin…</span>}
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container footer-bottom__inner">
          <span>© {new Date().getFullYear()}{storeName ? ` ${storeName}` : ""}</span>
          <span>Thông tin do chủ thương hiệu cung cấp</span>
        </div>
      </div>
    </footer>
  );
}
