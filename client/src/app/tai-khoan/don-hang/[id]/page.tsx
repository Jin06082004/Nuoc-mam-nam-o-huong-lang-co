import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetailPage } from "@/components/shop-pages";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Chi tiết đơn hàng", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) notFound();
  return <OrderDetailPage orderId={orderId} />;
}
