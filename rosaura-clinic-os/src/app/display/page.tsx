import type { Metadata } from "next";
import { CustomerDisplay } from "@/components/display/CustomerDisplay";
import { getCustomerDisplay } from "@/services/display.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Layar pelanggan · Rosaura",
};

export default async function DisplayPage() {
  const initial = await getCustomerDisplay();
  return <CustomerDisplay initial={initial} />;
}
