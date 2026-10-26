import type { Metadata } from "next";
import { ReturnPolicyPage } from "@/components/shop-pages";

export const metadata: Metadata = {
  title: "Chính sách đổi trả & hoàn tiền",
  description: "Quy định đổi trả hàng trong 7 ngày đối với các sản phẩm Nước mắm Nam Ô Hương Làng Cổ.",
};

export default function Page() {
  return <ReturnPolicyPage />;
}
