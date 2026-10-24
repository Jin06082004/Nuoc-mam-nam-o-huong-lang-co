import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/components/providers";
import { SiteChrome } from "@/components/site-chrome";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nước mắm Nam Ô Hương Làng Cổ",
    template: "%s | Nước mắm Nam Ô Hương Làng Cổ",
  },
  description: "Website cửa hàng Nước mắm Nam Ô Hương Làng Cổ. Thông tin sản phẩm chính thức sẽ được chủ thương hiệu cập nhật.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Nước mắm Nam Ô Hương Làng Cổ",
    title: "Nước mắm Nam Ô Hương Làng Cổ",
    description: "Website cửa hàng Nước mắm Nam Ô Hương Làng Cổ.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f3e9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <StoreProvider>
          <SiteChrome>{children}</SiteChrome>
        </StoreProvider>
      </body>
    </html>
  );
}
