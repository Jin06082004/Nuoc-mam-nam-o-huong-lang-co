import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderSuccessPage } from "@/components/shop-pages";
import { Loading } from "@/components/ui";

export const metadata: Metadata = { title: "Đặt hàng thành công", robots: { index: false, follow: false } };
export default function Page() {
  return <Suspense fallback={<main className="page-shell container"><Loading /></main>}><OrderSuccessPage /></Suspense>;
}
