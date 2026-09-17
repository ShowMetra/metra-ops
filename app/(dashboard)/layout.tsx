import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/workspace";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspace();
  return <AppShell
    name={workspace.profile.fullName}
    organization={workspace.organization.name}
    role={workspace.membership.role}
  >{children}</AppShell>;
}
