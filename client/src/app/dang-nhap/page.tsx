import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPage } from "@/components/shop-pages";
import { Loading } from "@/components/ui";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false, follow: false } };
export default function Page() {
  return <Suspense fallback={<main className="auth-page container"><Loading /></main>}><AuthPage mode="login" /></Suspense>;
}
