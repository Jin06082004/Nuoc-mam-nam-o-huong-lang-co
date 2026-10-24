import type { Metadata } from "next";
import { Homepage } from "@/components/home";

export const metadata: Metadata = {
  title: "Nước mắm Nam Ô Hương Làng Cổ",
  description: "Khám phá danh mục và thông tin do chủ thương hiệu Nước mắm Nam Ô Hương Làng Cổ cung cấp.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <Homepage />;
}
