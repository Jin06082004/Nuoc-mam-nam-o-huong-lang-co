import type { Metadata } from "next";
import { PrivacyPolicyPage } from "@/components/shop-pages";

export const metadata: Metadata = {
  title: "Chính sách bảo mật thông tin",
  description: "Cam kết bảo mật thông tin dữ liệu khách hàng theo Nghị định 13/2023/NĐ-CP tại Nước mắm Nam Ô Hương Làng Cổ.",
};

export default function Page() {
  return <PrivacyPolicyPage />;
}
