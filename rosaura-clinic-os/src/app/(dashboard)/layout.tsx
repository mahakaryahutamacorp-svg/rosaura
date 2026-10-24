import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/access";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
