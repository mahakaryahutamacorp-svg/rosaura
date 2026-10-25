import { NextResponse } from "next/server";
import { getCustomerDisplay } from "@/services/display.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getCustomerDisplay();
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
