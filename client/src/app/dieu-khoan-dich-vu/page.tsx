import type { Metadata } from "next";
import { TermsPage } from "@/components/shop-pages";

export const metadata: Metadata = {
  title: "Điều khoản dịch vụ & Quy chế bán hàng",
  description: "Các điều khoản giao dịch, chính sách kiểm hàng và thanh toán tại Nước mắm Nam Ô Hương Làng Cổ.",
};

export default function Page() {
  return <TermsPage />;
}
