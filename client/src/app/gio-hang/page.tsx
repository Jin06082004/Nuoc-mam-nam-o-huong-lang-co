import type { Metadata } from "next";
import { CartPage } from "@/components/shop-pages";

export const metadata: Metadata = { title: "Giỏ hàng", robots: { index: false, follow: false } };
export default function Page() { return <CartPage />; }
