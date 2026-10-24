import type { Metadata } from "next";
import { OrderHistoryPage } from "@/components/shop-pages";

export const metadata: Metadata = { title: "Đơn hàng của tôi", robots: { index: false, follow: false } };
export default function Page() { return <OrderHistoryPage />; }
