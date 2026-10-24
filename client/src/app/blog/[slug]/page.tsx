import type { Metadata } from "next";
import { BlogPostPage } from "@/components/shop-pages";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: slug.replaceAll("-", " "),
    description: "Bài viết từ Nước mắm Nam Ô Hương Làng Cổ.",
    alternates: { canonical: `/blog/${encodeURIComponent(slug)}` },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  return <BlogPostPage slug={slug} />;
}
