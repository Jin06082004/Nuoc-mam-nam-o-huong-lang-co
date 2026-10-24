import type { Metadata } from "next";
import { CheckoutPage } from "@/components/shop-pages";

export const metadata: Metadata = { title: "Thanh toán", robots: { index: false, follow: false } };
export default function Page() { return <CheckoutPage />; }
