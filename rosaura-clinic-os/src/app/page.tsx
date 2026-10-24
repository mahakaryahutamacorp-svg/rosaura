import { redirect } from "next/navigation";
import { readSessionUserId } from "@/lib/session";

export default async function Home() {
  const userId = await readSessionUserId();
  redirect(userId ? "/dashboard" : "/login");
}
