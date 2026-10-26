import type { Metadata } from "next";
import { ContactPage } from "@/components/shop-pages";

export const metadata: Metadata = {
  title: "Liên hệ & Thăm xưởng",
  description: "Thông tin liên hệ, địa chỉ xưởng sản xuất và chỉ dẫn đường đi tới cơ sở Nước mắm Nam Ô Hương Làng Cổ tại Đà Nẵng.",
};

export default function Page() {
  return <ContactPage />;
}
