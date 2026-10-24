import type { Metadata } from "next";
import { AboutPage } from "@/components/shop-pages";

export const metadata: Metadata = {
  title: "Về thương hiệu",
  description: "Câu chuyện chính thức của Nước mắm Nam Ô Hương Làng Cổ sẽ được chủ thương hiệu cập nhật.",
};
export default function Page() { return <AboutPage />; }
