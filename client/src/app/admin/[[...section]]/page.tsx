import type { Metadata } from "next";
import { AdminApp } from "@/components/admin";

export const metadata: Metadata = { title: "Quản trị", robots: { index: false, follow: false } };

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  return <AdminApp section={section} />;
}
