import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductListing } from "@/components/products";
import { Loading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sản phẩm",
  description: "Danh mục sản phẩm Nước mắm Nam Ô Hương Làng Cổ.",
  alternates: { canonical: "/san-pham" },
};

export default function ProductsPage() {
  return <Suspense fallback={<main className="page-shell container"><Loading label="Đang mở danh mục…" /></main>}><ProductListing /></Suspense>;
}
