import type { Metadata } from "next";
import { Homepage } from "@/components/home";

export const metadata: Metadata = {
  title: "Nước Mắm Nam Ô — Hương Làng Cổ | Di Sản 400 Năm & OCOP 4 Sao Đà Nẵng",
  description: "Trang chính thức cơ sở Nước mắm Nam Ô — Hương Làng Cổ. 100% cá cơm than tươi và muối Sa Huỳnh ủ chượp lu sành tự nhiên 12-18 tháng. Đạt chuẩn OCOP 4 sao và Di sản phi vật thể Quốc gia. Vị trí xưởng tại Kiệt 884 Nguyễn Lương Bằng, TP. Đà Nẵng.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Nước Mắm Nam Ô — Hương Làng Cổ | Giữ Hồn Giọt Ngọc Đất Biển 400 Năm",
    description: "Nước mắm nhĩ cá cơm than ủ chượp thủ công trong lu sành dưới chân đèo Hải Vân. 100% nguyên chất, không phụ gia công nghiệp. Đạt chuẩn OCOP 4 sao Đà Nẵng.",
    url: "/",
    siteName: "Nước mắm Nam Ô Hương Làng Cổ",
    images: [{ url: "/images/hero-banner.jpg", width: 1200, height: 630, alt: "Xưởng Nước mắm Nam Ô Hương Làng Cổ" }],
    locale: "vi_VN",
    type: "website",
  },
};

export default function HomePage() {
  return <Homepage />;
}

