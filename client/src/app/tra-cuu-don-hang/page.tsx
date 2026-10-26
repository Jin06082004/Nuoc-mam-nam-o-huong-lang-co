import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderLookupPage } from "@/components/shop-pages";
import { Loading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Tra cứu đơn hàng",
  description:
    "Tra cứu tiến độ giao nhận, chi tiết sản phẩm và trạng thái thanh toán đơn hàng nước mắm Nam Ô Hương Làng Cổ bằng mã đơn và số điện thoại.",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="page-shell container">
          <Loading />
        </main>
      }
    >
      <OrderLookupPage />
    </Suspense>
  );
}
