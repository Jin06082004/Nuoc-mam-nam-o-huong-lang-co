import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/tai-khoan",
        "/tai-khoan/",
        "/gio-hang",
        "/thanh-toan",
        "/dang-nhap",
        "/dang-ky",
        "/dat-hang-thanh-cong",
      ],
    }],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
