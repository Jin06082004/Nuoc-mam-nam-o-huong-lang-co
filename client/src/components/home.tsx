"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Banner } from "@/lib/types";
import { Button, ProductImage, SectionHeading } from "./ui";
import { CategorySection, FeaturedProducts, VideoSection } from "./products";
import { useStore } from "./providers";

/* --- Inline Heritage & Location Icons --- */
function MapPinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function NavigationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function Homepage() {
  const { storeSettings, storeSettingsError, storeSettingsLoading } = useStore();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const storeName = storeSettings?.store_name.trim() || "Nước mắm Nam Ô Hương Làng Cổ";
  const heroImage = banner?.image_url || "/images/hero-banner.jpg";
  const storeAddress = storeSettings?.store_address || "Tổ 97 (Nam Ô 2), Kiệt 884/74/4 Nguyễn Lương Bằng, Phường Hòa Hiệp Nam, Quận Liên Chiểu, TP. Đà Nẵng";
  const contactPhone = storeSettings?.contact_phone || "0935998908";
  const contactEmail = storeSettings?.contact_email || "huonglangco.namo@gmail.com";

  // Tọa độ GPS chính xác tại xưởng Nam Ô: 16.099675, 108.136938 (Kiệt 884 Nguyễn Lương Bằng)
  const exactLat = 16.099675;
  const exactLng = 108.136938;
  const googleMapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${exactLat},${exactLng}`;
  const googleMapDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${exactLat},${exactLng}`;
  const googleMapEmbedUrl = `https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s${exactLat},${exactLng}!6i17!3m1!1svi!5m1!1svi`;

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

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <main className="landing-page-root">
      {/* 1. HERO LANDING SECTION */}
      <section className="landing-hero" aria-label="Giới thiệu thương hiệu Nước mắm Nam Ô Hương Làng Cổ">
        <div className="container landing-hero__grid">
          <div className="landing-hero__content">
            <div className="landing-badge">
              <span>🇻🇳</span>
              <span>{storeName} • Di sản phi vật thể Quốc gia • OCOP 4★</span>
            </div>
            <h1 className="landing-hero__title">
              Giữ Hồn Giọt Ngọc Nam Ô<br />
              <span style={{ color: "#f4ddb2" }}>400 Năm Đậm Đà Vị Biển</span>
            </h1>
            <p className="landing-hero__lead">
              Ủ chượp thủ công từ 100% cá cơm than tươi và muối Sa Huỳnh trong lu sành đất nung dày ròng rã 12 – 18 tháng dưới chân đèo Hải Vân. Giữ trọn vị mắm nhĩ cốt đậm đà, thơm nồng, hậu ngọt sâu từ đạm cá tự nhiên. Tuyệt đối không chất bảo quản, không hương liệu nhân tạo.
            </p>
            <div className="landing-hero__actions">
              <a href="#san-pham-chinh" className="btn-hero-primary">
                Đặt Mua Đặc Sản OCOP <span aria-hidden="true">↓</span>
              </a>
              <a href="#chi-dan-duong-di" className="btn-hero-secondary">
                <MapPinIcon /> Vị Trí Xưởng & Chỉ Dẫn Đường Đi
              </a>
            </div>

            {/* Quick Stats Grid */}
            <div className="landing-stats-grid" aria-label="Các thông số bảo chứng chất lượng">
              <div className="landing-stat-card">
                <div className="landing-stat-number">400+</div>
                <div className="landing-stat-label">Năm Di Sản Làng Nghề</div>
              </div>
              <div className="landing-stat-card">
                <div className="landing-stat-number">100%</div>
                <div className="landing-stat-label">Cá Cơm Than & Muối Biển</div>
              </div>
              <div className="landing-stat-card">
                <div className="landing-stat-number">12-18</div>
                <div className="landing-stat-label">Tháng Gài Nén Lu Sành</div>
              </div>
              <div className="landing-stat-card">
                <div className="landing-stat-number">OCOP 4★</div>
                <div className="landing-stat-label">Chuẩn Quốc Gia & HACCP</div>
              </div>
            </div>
          </div>

          <div className="landing-hero__visual">
            <div className="landing-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt="Xưởng ủ chượp nước mắm truyền thống Nam Ô Hương Làng Cổ tại Đà Nẵng"
                fetchPriority="high"
              />
              <div className="landing-hero__media-badge">
                <div>
                  <strong>Xưởng Mắm Hương Làng Cổ</strong>
                  <p>Tổ 97 (Nam Ô 2), Kiệt 884 Nguyễn Lương Bằng, Đà Nẵng</p>
                </div>
                <a href="#vi-tri-nha-san-xuat" style={{ color: "#f4ddb2", textDecoration: "underline", fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                  Chỉ đường ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HERITAGE PILLARS SECTION */}
      <section className="section" style={{ background: "var(--color-paper)" }} aria-label="Tinh hoa nguyên liệu làm mắm">
        <div className="container">
          <SectionHeading
            eyebrow="Tinh hoa nguyên liệu tự nhiên"
            title="Bốn Cột Trụ Danh Dự Tạo Nên Giọt Mắm Nhĩ Nam Ô"
            description="Khác biệt hoàn toàn với nước mắm công nghiệp, mỗi giọt mắm Hương Làng Cổ là kết tinh thuần khiết của thiên nhiên miền Trung và sự kiên nhẫn qua năm tháng."
          />
          <div className="heritage-grid">
            <article className="heritage-card">
              <div className="heritage-card__icon" aria-hidden="true">🐟</div>
              <h3>Cá Cơm Than Tháng Ba</h3>
              <p>Chỉ chọn cá cơm than béo múp, tươi óng ánh vừa đánh bắt từ vùng biển Nam Ô – Hải Vân vào đúng cữ tháng 3 âm lịch, thời điểm cá đạt hàm lượng đạm tự nhiên cao nhất.</p>
            </article>

            <article className="heritage-card">
              <div className="heritage-card__icon" aria-hidden="true">🧂</div>
              <h3>Muối Sa Huỳnh Lưu Kho 2 Năm</h3>
              <p>Muối hạt tinh khiết từ vựa muối Sa Huỳnh (Quảng Ngãi), được trữ kho từ 1 đến 2 năm để tự triệt tiêu vị chát đắng của muối non, chỉ giữ lại vị mặn thanh khiết làm đượm ngọt thịt cá.</p>
            </article>

            <article className="heritage-card">
              <div className="heritage-card__icon" aria-hidden="true">🏺</div>
              <h3>Lu Sành Đất Nung Dày Dặn</h3>
              <p>Ủ chượp theo tỷ lệ vàng 3 cá : 1 muối trong những chiếc lu sành đất nung dày, phơi nắng gió tự nhiên dưới chân đèo Hải Vân suốt 12 đến 18 tháng ròng rã mà không dùng nhiệt nhân tạo.</p>
            </article>

            <article className="heritage-card">
              <div className="heritage-card__icon" aria-hidden="true">✨</div>
              <h3>Mắm Nhĩ Cốt Đầu Hổ Phách</h3>
              <p>Từng giọt mắm nhĩ cốt đầu được kéo rút thủ công qua phễu tre lót vải mịn, màu nâu cánh gián hổ phách trong veo, sóng sánh, hương thơm nồng nàn quyến rũ và hậu vị ngọt sâu lưu luyến.</p>
            </article>
          </div>
        </div>
      </section>

      {/* 3. FOUNDER & HERITAGE STORY */}
      <section className="section section--soft" aria-label="Câu chuyện nghệ nhân Bùi Thanh Phú">
        <div className="container">
          <SectionHeading
            eyebrow="Người giữ lửa làng nghề 400 năm"
            title="Từ Người Thầy Giáo Đến Sứ Mệnh Chấn Hưng Mắm Cổ Nam Ô"
            description="Nghệ nhân Bùi Thanh Phú — Thế hệ thứ 4 trong gia đình gắn bó với nghiệp làm mắm truyền thống xứ Đàng Trong."
          />
          <div className="craftsman-spotlight">
            <div>
              <blockquote className="craftsman-quote">
                “Nước mắm Nam Ô không chỉ là một gia vị trên mâm cơm gia đình, mà là cả một bầu trời ký ức, là giọt mồ hôi của bao đời ngư dân chắt chiu dưới chân đèo Hải Vân. Chúng tôi không bao giờ đánh đổi phẩm giá truyền thống lấy sự vội vàng công nghiệp.”
              </blockquote>
              <div className="craftsman-meta">
                <strong>Nghệ nhân Bùi Thanh Phú</strong>
                <span>Nhà sáng lập Nước Mắm Nam Ô — Hương Làng Cổ | Nông dân Việt Nam xuất sắc</span>
              </div>
              <p style={{ marginTop: "16px", color: "var(--color-muted)", fontSize: "0.95rem", lineHeight: 1.65 }}>
                Từng tốt nghiệp Thạc sĩ CNTT và giảng dạy, anh Bùi Thanh Phú đã quyết định trở về quê hương gìn giữ nghề tổ khi nhận thấy nghề làm mắm Nam Ô có nguy cơ mai một. Bằng tình yêu di sản và quy chuẩn chất lượng khắt khe, anh đã đưa Hương Làng Cổ đạt chuẩn OCOP 4 sao và trở thành điểm du lịch trải nghiệm văn hóa tiêu biểu của thành phố Đà Nẵng.
              </p>
            </div>

            <div>
              <ul className="craftsman-credentials-list">
                <li>
                  <span className="badge-num">01</span>
                  <div>
                    <strong>Pháp nhân & Cơ sở chuẩn chỉ</strong>
                    <span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.85rem" }}>CÔNG TY TNHH MẮM HỒNG HƯƠNG (MST: 0401801078)</span>
                  </div>
                </li>
                <li>
                  <span className="badge-num">02</span>
                  <div>
                    <strong>Di sản văn hóa phi vật thể Quốc gia</strong>
                    <span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.85rem" }}>Theo Quyết định số 2974/QĐ-BVHTTDL của Bộ VHTTDL</span>
                  </div>
                </li>
                <li>
                  <span className="badge-num">03</span>
                  <div>
                    <strong>OCOP 4 sao & Quốc tế HACCP</strong>
                    <span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.85rem" }}>UBND TP. Đà Nẵng cấp chứng nhận sản phẩm đặc sản tiêu biểu</span>
                  </div>
                </li>
                <li>
                  <span className="badge-num">04</span>
                  <div>
                    <strong>Báo chí chính thống bảo chứng</strong>
                    <span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.85rem" }}>Đưa tin bởi Báo Nhân Dân, Báo Tuổi Trẻ, Báo Đà Nẵng, Dân Việt</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FOUR-STEP CRAFTSMANSHIP PROCESS */}
      <section className="section" style={{ background: "var(--color-paper)" }} aria-label="Quy trình 4 bước sản xuất nước mắm Nam Ô">
        <div className="container">
          <SectionHeading
            eyebrow="Bí quyết cha truyền con nối"
            title="Quy Trình 4 Bước Tạo Nên Tinh Hoa Nước Mắm Nhĩ Cốt"
            description="Mỗi mẻ mắm cần trọn vẹn từ 12 đến 18 tháng kiên nhẫn để từng con cá cơm phân rã tự nhiên thành dòng đạm sánh mịn."
          />
          <div className="craft-steps-grid">
            <article className="craft-step-card">
              <div className="craft-step-number">01</div>
              <h3>Đánh Bắt Cá Tươi Vịnh Nam Ô</h3>
              <p>Cá cơm than đánh bắt lúc rạng đông từ các thuyền nan làng chài, đưa thẳng vào bờ rửa sạch bằng nước biển tinh khiết, loại bỏ hoàn toàn cá tạp và tạp chất.</p>
            </article>

            <article className="craft-step-card">
              <div className="craft-step-number">02</div>
              <h3>Ủ Kho Muối Hạt Khử Vị Chát</h3>
              <p>Muối Sa Huỳnh hạt đều, tinh trắng được lưu trữ trên sàn gỗ thoáng khí 1-2 năm để mật muối chảy hết, giúp nước mắm không bị mặn gắt mà có vị mặn đượm êm dịu.</p>
            </article>

            <article className="craft-step-card">
              <div className="craft-step-number">03</div>
              <h3>Gài Nén Lu Sành 18 Tháng</h3>
              <p>Cá trộn đều cùng muối theo công thức gia truyền, đưa vào các lu sành cổ, đè nẹp tre cẩn thận và phơi dưới nắng ấm biển Đà Nẵng để men cá chuyển hóa tự nhiên.</p>
            </article>

            <article className="craft-step-card">
              <div className="craft-step-number">04</div>
              <h3>Kéo Rút Nhĩ Cốt & Đóng Chai</h3>
              <p>Mở lù kéo rút từng giọt mắm nhĩ cốt đầu hổ phách sóng sánh. Nước mắm được lọc lắng tự nhiên, chiếu tia UV tiệt trùng và đóng vào chai thủy tinh an toàn tuyệt đối.</p>
            </article>
          </div>
        </div>
      </section>

      {/* 5. TRANSPARENT COMPARISON TABLE */}
      <section className="section section--soft" aria-label="So sánh nước mắm Nam Ô và nước mắm công nghiệp">
        <div className="container">
          <SectionHeading
            eyebrow="Minh bạch cùng người tiêu dùng"
            title="Bảng Đối Chiếu: Nước Mắm Nam Ô Hương Làng Cổ vs Nước Mắm Công Nghiệp"
            description="Hiểu rõ sự khác biệt giữa nước mắm truyền thống nguyên bản và nước mắm pha chế hóa học công nghiệp để bảo vệ sức khỏe cả gia đình."
          />
          <div className="comparison-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Tiêu chí kiểm chứng</th>
                  <th className="brand-col" style={{ width: "39%" }}>Nước mắm Nam Ô — Hương Làng Cổ</th>
                  <th style={{ width: "39%" }}>Nước mắm công nghiệp đóng chai đại trà</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Thành phần công bố</strong></td>
                  <td className="brand-col">✓ 100% Cá cơm than tươi và Muối biển Sa Huỳnh. Không chất bảo quản, không mì chính, không phẩm màu.</td>
                  <td>✗ Nước cốt mắm pha loãng, chất điều vị (621, 627, 631), hương liệu tổng hợp, màu caramel, chất bảo quản (211).</td>
                </tr>
                <tr>
                  <td><strong>Thời gian sản xuất</strong></td>
                  <td className="brand-col">✓ 12 – 18 tháng ủ chượp tự nhiên gài nén ròng rã trong lu sành đất nung cổ truyền.</td>
                  <td>✗ Chỉ mất vài ngày đến vài tuần bằng phương pháp pha chế hóa chất công nghiệp rút ngắn.</td>
                </tr>
                <tr>
                  <td><strong>Màu sắc & Phản ứng oxy</strong></td>
                  <td className="brand-col">✓ Màu cánh gián hổ phách trong vắt; sẽ sẫm màu dần sau khi mở nắp do đạm cá tự nhiên phản ứng với không khí.</td>
                  <td>✗ Màu vàng óng nhân tạo nhờ phẩm màu, để lâu tiếp xúc không khí không hề đổi màu do có chất chống oxy hóa hóa học.</td>
                </tr>
                <tr>
                  <td><strong>Cảm nhận vị giác</strong></td>
                  <td className="brand-col">✓ Đầu lưỡi cảm nhận vị mặn đượm tự nhiên của muối biển, ngay sau đó là hậu vị ngọt béo sâu của đạm cá thật.</td>
                  <td>✗ Vị ngọt lợ nhân tạo từ đường hóa học và chất điều vị lấn át hoàn toàn vị mắm thật, không có hậu vị sâu.</td>
                </tr>
                <tr>
                  <td><strong>Chứng nhận & Di sản</strong></td>
                  <td className="brand-col">✓ OCOP 4 sao TP. Đà Nẵng, chuẩn an toàn HACCP, Di sản văn hóa phi vật thể Quốc gia.</td>
                  <td>✗ Sản xuất dây chuyền hàng loạt, không mang giá trị văn hóa hay bí quyết di sản làng nghề.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6. FEATURED PRODUCTS CATALOG */}
      <div id="san-pham-chinh">
        <FeaturedProducts />
      </div>

      {/* 7. GOOGLE MAPS INTERACTIVE LOCATION & DIRECTIONS SECTION (CORE REQUIREMENT) */}
      <section id="chi-dan-duong-di" className="map-section" aria-label="Vị trí xưởng sản xuất và chỉ dẫn đường đi Nước mắm Nam Ô Hương Làng Cổ">
        <div className="container">
          <SectionHeading
            eyebrow="Định vị & Chỉ dẫn đường đi"
            title="Vị Trí Xưởng Sản Xuất & Chỉ Dẫn Đường Đi Chi Tiết"
            description="Tọa độ GPS chính xác: 16.099675° N, 108.136938° E. Cơ sở Nước mắm Nam Ô — Hương Làng Cổ luôn mở rộng cửa đón chào quý du khách ghé thăm tận mắt hàng trăm lu sành ủ mắm và thưởng thức giọt mắm nhĩ cốt ngay tại xưởng."
          />

          {/* PHẦN ĐIỂM CHỈ DẪN ĐƯỜNG ĐI (ĐẶT Ở TRÊN) */}
          <div className="directions-cards-grid">
            {/* Thẻ 1: Thông tin cơ sở & Điểm đến */}
            <div className="direction-card">
              <div>
                <div className="direction-card-title">
                  <span className="icon-badge"><BuildingIcon /></span>
                  <span>Cơ Sở Sản Xuất Hương Làng Cổ</span>
                </div>
                <div className="direction-card-body">
                  <p><strong>Đơn vị:</strong> CÔNG TY TNHH MẮM HỒNG HƯƠNG</p>
                  <p><strong>Người đại diện:</strong> Nghệ nhân Bùi Thanh Phú</p>
                  <p><strong>Mã số thuế:</strong> 0401801078 (Chi cục Thuế Q. Liên Chiểu)</p>
                  <p><strong>Địa chỉ:</strong> {storeAddress}</p>
                  <p><strong>Tọa độ GPS:</strong> <code>{exactLat}° N, {exactLng}° E</code></p>
                </div>
              </div>
            </div>

            {/* Thẻ 2: Hướng dẫn 2 tuyến đường di chuyển */}
            <div className="direction-card">
              <div>
                <div className="direction-card-title">
                  <span className="icon-badge">🚗</span>
                  <span>Điểm Chỉ Dẫn Tuyến Đường Tới Xưởng</span>
                </div>
                <div className="direction-card-body">
                  <p>
                    <strong>Tuyến 1 (Đường biển Nguyễn Tất Thành):</strong> Từ trung tâm Đà Nẵng, đi dọc đại lộ biển ngắm vịnh tới cuối đường, rẽ trái vào Nguyễn Lương Bằng, đi 300m đến số <strong>884 Nguyễn Lương Bằng</strong> (ngay chân cầu Nam Ô), rẽ vào Kiệt 884 đi 200m là đến cổng xưởng.
                  </p>
                  <p>
                    <strong>Tuyến 2 (Trục Quốc lộ 1A):</strong> Từ Cầu vượt Ngã Ba Huế, đi thẳng Tôn Đức Thắng nối dài Nguyễn Lương Bằng tới Kiệt 884 bên tay phải.
                  </p>
                  <p style={{ color: "var(--color-wood)", fontWeight: 600 }}>
                    🎯 Xe máy, ô tô 4 – 16 chỗ vào tận cổng xưởng có sân đỗ rộng và chỗ quay đầu thuận tiện.
                  </p>
                </div>
              </div>
            </div>

            {/* Thẻ 3: Thời gian tiếp đón & Điều hướng nhanh */}
            <div className="direction-card">
              <div>
                <div className="direction-card-title">
                  <span className="icon-badge"><ClockIcon /></span>
                  <span>Đón Khách & Điều Hướng GPS</span>
                </div>
                <div className="direction-card-body">
                  <p>
                    <strong>Giờ mở cửa đón khách:</strong><br />
                    07:30 – 17:30 (Mở cửa tất cả các ngày trong tuần, kể cả Thứ 7 và Chủ Nhật — Miễn phí tham quan).
                  </p>
                  <p>
                    <strong>Hotline hỗ trợ chỉ đường 24/7:</strong><br />
                    <a href={`tel:${contactPhone}`} style={{ color: "var(--color-wood)", fontWeight: 700, fontSize: "1.05rem" }}>
                      {contactPhone}
                    </a>
                  </p>
                  <p><strong>Email:</strong> <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
                </div>
              </div>

              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <a
                  href={googleMapDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-map-directions"
                >
                  <NavigationIcon /> Chỉ Đường Trên Google Maps (GPS) ↗
                </a>
                <a
                  href={googleMapSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-map-external"
                >
                  <ExternalLinkIcon /> Mở Ứng Dụng Google Maps ↗
                </a>
              </div>
            </div>
          </div>

          {/* HIỂN THỊ CẢ GIAO DIỆN CỦA GOOGLE MAP VÀO PHÍA DƯỚI ĐIỂM CHỈ DẪN */}
          <div className="map-fullwidth-wrapper">
            <div className="map-fullwidth-header">
              <div className="map-live-pill">
                <span className="map-live-dot" />
                <span>GIAO DIỆN GOOGLE MAPS — VỊ TRÍ CHÍNH XÁC: KIỆT 884 NGUYỄN LƯƠNG BẰNG, NAM Ô, ĐÀ NẴNG</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.84rem", color: "var(--color-muted)" }}>
                <span>GPS: <strong>{exactLat}, {exactLng}</strong></span>
                <a
                  href={googleMapDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-wood)", fontWeight: 600, textDecoration: "underline" }}
                >
                  Dẫn đường trực tiếp ↗
                </a>
              </div>
            </div>
            <iframe
              src={googleMapEmbedUrl}
              className="map-fullwidth-iframe"
              title="Giao diện đầy đủ của Google Maps hiển thị vị trí chính xác xưởng Nước mắm Nam Ô Hương Làng Cổ"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* 8. VIDEO & CATEGORY SECTIONS */}
      <VideoSection />
      <CategorySection />

      {/* 9. FREQUENTLY ASKED QUESTIONS (FAQ) */}
      <section className="section" style={{ background: "var(--color-paper)" }} aria-label="Giải đáp thắc mắc thường gặp">
        <div className="container">
          <SectionHeading
            eyebrow="Tư vấn tận tâm"
            title="Câu Hỏi Thường Gặp Về Nước Mắm Nam Ô"
            description="Giải đáp chi tiết các thắc mắc của khách hàng khi chọn mua và sử dụng nước mắm truyền thống Nam Ô."
          />
          <div className="faq-grid">
            {[
              {
                q: "1. Nước mắm Nam Ô Hương Làng Cổ có độ mặn và mùi thơm khác nước mắm công nghiệp như thế nào?",
                a: "Nước mắm Nam Ô truyền thống được ủ chượp tự nhiên từ cá cơm than và muối biển nên có vị mặn đượm ban đầu ở đầu lưỡi, ngay sau đó là hậu vị ngọt béo sâu lan tỏa nhờ hàm lượng đạm axit amin tự nhiên từ cá. Mùi thơm nồng đặc trưng, thơm đậm đà đúng chất mắm miền Trung cổ truyền, hoàn toàn không có mùi nhân tạo của hương liệu pha chế.",
              },
              {
                q: "2. Tại sao sau khi dùng một thời gian mắm chuyển màu sẫm hơn và có muối kết tinh ở đáy chai?",
                a: "Đây chính là dấu hiệu bảo chứng 100% nước mắm truyền thống nguyên chất không pha hóa chất. Khi mở nắp, đạm cá tự nhiên tiếp xúc với không khí sẽ diễn ra quá trình oxy hóa tự nhiên làm nước mắm sẫm màu dần. Muối kết tinh ở đáy chai là muối Sa Huỳnh kết tinh lại khi nhiệt độ thay đổi. Hiện tượng này hoàn toàn bình thường và nước mắm vẫn giữ nguyên chất lượng thơm ngon.",
              },
              {
                q: "3. Đặt hàng giao đi xa (Hà Nội, TP.HCM, các tỉnh) chai thủy tinh có bị vỡ hoặc rò rỉ không?",
                a: "Quý khách hoàn toàn an tâm. Toàn bộ đơn hàng gửi xa đều được bọc túi khí chống va đập 3 lớp và đóng trong thùng carton định hình chuyên dụng. Hương Làng Cổ cam kết bảo hiểm 100% cho mọi kiện hàng: nếu có bất kỳ hiện tượng nứt vỡ hoặc rò rỉ trong quá trình vận chuyển, xưởng sẽ lập tức gửi kiện hàng mới thay thế hoàn toàn miễn phí.",
              },
              {
                q: "4. Tôi muốn đến tham quan xưởng, trải nghiệm văn hóa hoặc đặt hộp quà biếu số lượng lớn thì liên hệ ra sao?",
                a: "Xưởng mở cửa từ 07:30 đến 17:30 tất cả các ngày trong tuần (kể cả Thứ 7 và Chủ Nhật, miễn phí vé vào cổng). Đối với khách đoàn đông người, trường học hoặc doanh nghiệp đặt hộp quà biếu đối tác, quý khách vui lòng liên hệ trước qua Hotline/Zalo: 0935 998 908 để xưởng chuẩn bị đón tiếp chu đáo nhất.",
              },
            ].map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className={`faq-card ${isOpen ? "faq-card--open" : ""}`}>
                  <div className="faq-header" onClick={() => toggleFaq(idx)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleFaq(idx); } }}>
                    <h3>{item.q}</h3>
                    <span className="faq-toggle-icon" aria-hidden="true">+</span>
                  </div>
                  {isOpen && <div className="faq-body">{item.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 10. SOCIAL CONNECTIONS */}
      <section className="section home-social">
        <div className="container home-social__inner">
          <div>
            <p className="eyebrow">Kết nối cùng thương hiệu</p>
            <h2>Theo Dõi Hương Làng Cổ Trên Các Nền Tảng</h2>
            <p>Cập nhật hình ảnh hoạt động đánh bắt cá, cất mắm mới và các phóng sự di sản làng nghề Nam Ô.</p>
          </div>
          <div className="home-social__links">
            {socialLinks.map((item) => (
              <a className="social-pill" href={item.url} target="_blank" rel="noopener noreferrer" key={item.name}>
                {item.name} <span aria-hidden="true">↗</span>
              </a>
            ))}
            {storeSettingsError && <span className="footer-note">Chưa tải được thông tin cửa hàng.</span>}
            {!storeSettingsLoading && !storeSettingsError && socialLinks.length === 0 && (
              <span className="footer-note">Chưa có liên kết mạng xã hội.</span>
            )}
          </div>
        </div>
      </section>

      {/* 11. CLOSING HIGH-CONVERTING CTA */}
      <section className="closing-cta" style={{ background: "linear-gradient(135deg, #2e281e 0%, #1f1d19 100%)", color: "#fff", borderTop: "1px solid rgba(189, 153, 93, 0.3)" }}>
        <div className="container closing-cta__inner">
          <div>
            <p className="eyebrow" style={{ color: "#f4ddb2" }}>Đặc sản Đà Nẵng — Quà biếu tinh tế</p>
            <h2 style={{ color: "#fffef9" }}>Thưởng Thức Hương Vị Mắm Nhĩ Thật 400 Năm</h2>
            <p style={{ color: "#d6cebf" }}>Giao hàng tận nơi toàn quốc • Đóng gói an toàn chống va đập • Cam kết 100% nguyên chất xuất xưởng.</p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Button href="/san-pham" variant="secondary">Khám phá sản phẩm <span aria-hidden="true">→</span></Button>
            <a href={`tel:${contactPhone}`} className="btn-hero-primary" style={{ padding: "12px 22px" }}>
              <PhoneIcon /> Hotline: {contactPhone}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

export function BrandMarkPlaceholder() {
  return (
    <div className="brand-mark-placeholder">
      <ProductImage alt="Logo thương hiệu Nước mắm Nam Ô Hương Làng Cổ" />
      <span>Logo chính thức Nước mắm Nam Ô — Hương Làng Cổ</span>
    </div>
  );
}
