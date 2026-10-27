import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordPage } from "@/components/shop-pages";
import { Loading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  description: "Đặt lại mật khẩu tài khoản Nước mắm Nam Ô Hương Làng Cổ qua mã xác thực Gmail OTP.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="page-shell container">
          <Loading label="Đang tải…" />
        </main>
      }
    >
      <ForgotPasswordPage />
    </Suspense>
  );
}
