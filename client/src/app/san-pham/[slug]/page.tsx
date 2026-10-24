import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/products";
import { api, ApiError } from "@/lib/api";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await api.product(slug);
    return {
      title: `${product.name} | Hương Làng Cổ`,
      description: product.short_description || product.description?.slice(0, 160) || `Thông tin ${product.name} từ Nước mắm Nam Ô Hương Làng Cổ.`,
      alternates: { canonical: `/san-pham/${encodeURIComponent(product.slug)}` },
      openGraph: {
        title: `${product.name} | Hương Làng Cổ`,
        description: product.short_description || `Thông tin ${product.name} từ Hương Làng Cổ.`,
        images: product.primary_image ? [{ url: product.primary_image, alt: product.name }] : undefined,
      },
    };
  } catch {
    return { title: "Sản phẩm", description: "Chi tiết sản phẩm Nước mắm Nam Ô Hương Làng Cổ." };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  try {
    const product = await api.product(slug);
    return <ProductDetail initialProduct={product} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
