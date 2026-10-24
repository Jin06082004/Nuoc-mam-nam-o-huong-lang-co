import type { Metadata } from "next";
import { BlogListingPage } from "@/components/shop-pages";

export const metadata: Metadata = {
  title: "Bài viết",
  description: "Bài viết và nội dung được đăng tải bởi Nước mắm Nam Ô Hương Làng Cổ.",
};
export default function Page() { return <BlogListingPage />; }
