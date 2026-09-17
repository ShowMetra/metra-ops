import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cache } from "react";

export type WorkspaceContext = {
  user: { id: string; email: string };
  profile: { fullName: string };
  membership: { organizationId: string; role: "owner" | "partner" };
  organization: { id: string; name: string; timezone: string; baseCurrency: string };
};

export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  const [{ data: organization }, { data: profile }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, timezone, base_currency")
      .eq("id", member.organization_id)
      .single(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  if (!organization) return null;

  return {
    user: { id: user.id, email: user.email },
    profile: { fullName: profile?.full_name || user.user_metadata?.full_name || user.email },
    membership: {
      organizationId: member.organization_id,
      role: member.role as "owner" | "partner",
    },
    organization: {
      id: organization.id,
      name: organization.name,
      timezone: organization.timezone,
      baseCurrency: organization.base_currency,
    },
  };
});

export async function requireWorkspace() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceContext();
  if (!workspace) redirect("/onboarding");
  return workspace;
}
