import type { Metadata } from "next";
import { AdminLoginPage } from "@/components/admin";

export const metadata: Metadata = { title: "Đăng nhập quản trị", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminLoginPage />;
}
