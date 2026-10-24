import type { Metadata } from "next";
import { AccountPage } from "@/components/shop-pages";

export const metadata: Metadata = { title: "Tài khoản", robots: { index: false, follow: false } };
export default function Page() { return <AccountPage />; }
