import type { MetadataRoute } from "next";
import type { BlogPost, Product } from "@/lib/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3001/api";

export const dynamic = "force-dynamic";

async function fetchPublicData<T>(path: string): Promise<T[]> {
  try {
    const firstPageUrl = new URL(`${apiBaseUrl}${path}`);
    firstPageUrl.searchParams.set("page", "1");
    firstPageUrl.searchParams.set("limit", "100");
    const firstResponse = await fetch(firstPageUrl, { cache: "no-store" });
    if (!firstResponse.ok) throw new Error(`HTTP ${firstResponse.status}`);
    const firstPage = await firstResponse.json() as {
      data?: T[];
      meta?: { total?: number; limit?: number };
    };
    if (!Array.isArray(firstPage.data)) throw new Error("Unexpected paginated response");
    const results = [...firstPage.data];
    const limit = firstPage.meta?.limit ?? 100;
    const pageCount = Math.ceil((firstPage.meta?.total ?? results.length) / limit);
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, pageCount - 1) }, async (_, index) => {
        const url = new URL(firstPageUrl);
        url.searchParams.set("page", String(index + 2));
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const page = await response.json() as { data?: T[] };
        if (!Array.isArray(page.data)) throw new Error("Unexpected paginated response");
        return page.data;
      }),
    );
    for (const page of remainingPages) results.push(...page);
    return results;
  } catch (error) {
    console.error(`Sitemap data request failed: ${path}`, error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, blogPosts] = await Promise.all([
    fetchPublicData<Product>("/products?limit=100"),
    fetchPublicData<BlogPost>("/blog/posts?limit=100"),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: new URL("/", siteUrl).toString(), changeFrequency: "weekly", priority: 1 },
    { url: new URL("/san-pham", siteUrl).toString(), changeFrequency: "daily", priority: 0.8 },
    { url: new URL("/gioi-thieu", siteUrl).toString(), changeFrequency: "monthly", priority: 0.5 },
    { url: new URL("/blog", siteUrl).toString(), changeFrequency: "weekly", priority: 0.6 },
  ];

  return [
    ...staticPages,
    ...products.map((product) => ({
      url: new URL(`/san-pham/${encodeURIComponent(product.slug)}`, siteUrl).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...blogPosts.map((post) => ({
      url: new URL(`/blog/${encodeURIComponent(post.slug)}`, siteUrl).toString(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
