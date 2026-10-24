"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Banner } from "@/lib/types";
import { Button, ProductImage, SectionHeading } from "./ui";
import { BrandStory, CategorySection, FeaturedProducts, VideoSection } from "./products";
import { useStore } from "./providers";

export function Homepage() {
  const { storeSettings, storeSettingsError, storeSettingsLoading } = useStore();
  const [banner, setBanner] = useState<Banner | null>(null);
  const storeName = storeSettings?.store_name.trim() || "Nước mắm Nam Ô Hương Làng Cổ";
  const heroImage = banner?.image_url || "/images/hero-banner.jpg";
  const heroTitle = banner?.title || `${storeName} - Giữ hương làng, gìn vị quê`;
  const heroLink = banner?.link_url || "/san-pham";
  const socialLinks = [
    { name: "Facebook", url: storeSettings?.facebook_url },
    { name: "TikTok", url: storeSettings?.tiktok_url },
    { name: "YouTube", url: storeSettings?.youtube_url },
  ].filter((link): link is { name: string; url: string } => Boolean(link.url));
  useEffect(() => {
    let active = true;
    void api.banners().then((result) => {
      if (active) setBanner(result.data[0] ?? null);
    }).catch(() => {
      if (active) setBanner(null);
    });
    return () => { active = false; };
  }, []);

  return (
    <main>
      <section className="hero" aria-label="Banner thương hiệu">
        <h1 className="sr-only">Nước mắm Nam Ô Hương Làng Cổ - Giữ hương làng, gìn vị quê</h1>
        <div className="hero__banner-wrapper">
          <Link href={heroLink} className="hero__banner-link" aria-label="Xem sản phẩm Nước mắm Nam Ô Hương Làng Cổ">
            <div className="hero__media">
              {/* Banner URLs are managed through the API, so Next Image cannot use a bounded remote-host allowlist. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={heroTitle}
                fetchPriority="high"
                className="hero__banner-img"
              />
            </div>
          </Link>
          <div className="hero__bar">
            <div className="container hero__bar-inner">
              <div className="hero__bar-info">
                <span className="hero__badge">Đặc sản truyền thống Nam Ô</span>
                <p className="hero__bar-text">
                  {storeSettings?.store_description || "Nước mắm cá cơm than ủ chượp tự nhiên — Giữ hương làng, gìn vị quê."}
                </p>
              </div>
              <div className="hero__actions">
                <Button href="/san-pham">Khám phá sản phẩm <span aria-hidden="true">→</span></Button>
                <Button href="/gioi-thieu" variant="secondary">Về thương hiệu</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Định hướng thương hiệu">
        <div className="container trust-strip__inner">
          <span>Truyền thống</span><i aria-hidden="true" /><span>Mộc mạc</span><i aria-hidden="true" /><span>Bản sắc Nam Ô</span><i aria-hidden="true" /><span>Trải nghiệm hiện đại</span>
        </div>
      </section>

      <FeaturedProducts />
      <BrandStory />
      <section className="section values-section">
        <div className="container">
          <SectionHeading eyebrow="Định hướng thương hiệu" title="Giá trị được gìn giữ" description="Những nét định hướng thương hiệu đã được chủ sở hữu xác định." />
          <div className="values-grid">
            {[
              ["01", "Truyền thống", "Tôn trọng bản sắc làng nghề và giá trị đã được chủ thương hiệu xác nhận."],
              ["02", "Mộc mạc", "Một trải nghiệm gần gũi, rõ ràng, không phô trương."],
              ["03", "Đáng tin cậy", "Thông tin sản phẩm được công bố minh bạch, không tự suy diễn."],
            ].map(([number, title, description]) => (
              <article className="value-card" key={number}>
                <span>{number}</span><h3>{title}</h3><p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <VideoSection />
      <CategorySection />
      <section className="section home-social">
        <div className="container home-social__inner">
          <div><p className="eyebrow">Kết nối cùng thương hiệu</p><h2>Theo dõi những cập nhật mới</h2><p>Liên kết được quản lý trong cài đặt cửa hàng.</p></div>
          <div className="home-social__links">
            {socialLinks.map((item) => <a className="social-pill" href={item.url} target="_blank" rel="noopener noreferrer" key={item.name}>{item.name}<span aria-hidden="true">↗</span></a>)}
            {storeSettingsError && <span className="footer-note">Chưa tải được thông tin cửa hàng.</span>}
            {!storeSettingsLoading && !storeSettingsError && socialLinks.length === 0 && <span className="footer-note">Chưa có liên kết mạng xã hội.</span>}
          </div>
        </div>
      </section>
      <section className="closing-cta">
        <div className="container closing-cta__inner">
          <div><p className="eyebrow">Danh mục cửa hàng</p><h2>Khám phá sản phẩm</h2><p>Giá và thông tin chi tiết sẽ hiển thị theo dữ liệu chính thức.</p></div>
          <Button href="/san-pham" variant="secondary">Xem sản phẩm <span aria-hidden="true">→</span></Button>
        </div>
      </section>
    </main>
  );
}

export function BrandMarkPlaceholder() {
  return <div className="brand-mark-placeholder"><ProductImage alt="Logo thương hiệu sẽ được bổ sung bởi chủ sở hữu" /><span>Logo chính thức sẽ được cập nhật</span></div>;
}
