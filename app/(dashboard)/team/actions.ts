"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { headers } from "next/headers";

export type InviteState = { error?: string; inviteUrl?: string; email?: string };

export async function invitePartner(_: InviteState, formData: FormData): Promise<InviteState> {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "owner") return { error: "Only the owner can invite partners." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_partner_invitation_v1", {
    p_organization_id: workspace.organization.id,
    p_email: email,
  });
  if (error) return { error: error.message, email };

  const invitation = data as { token: string };
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { email, inviteUrl: `${origin}/invite/${invitation.token}` };
}
