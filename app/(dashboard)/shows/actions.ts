"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const showsError = (message: string) => `/shows?error=${encodeURIComponent(message)}`;

export async function createShow(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(showsError("Only partners can create shows."));
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 2) redirect(showsError("Enter a show name."));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shows").insert({
    organization_id: workspace.organization.id,
    partner_user_id: workspace.user.id,
    name,
    code: code || null,
    description: description || null,
    status: "planned",
  });
  if (error?.code === "23505") redirect(showsError("A show with this name already exists."));
  if (error) redirect(showsError("Could not create the show."));

  revalidatePath("/shows");
  revalidatePath("/dashboard");
  redirect("/shows?message=Show+created");
}

export async function archiveShow(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(showsError("Only partners can archive shows."));
  const showId = String(formData.get("show_id") ?? "");
  if (!showId) redirect(showsError("Show not found."));

  const supabase = await createSupabaseServerClient();
  const [{ data: show }, { data: futurePerformance }] = await Promise.all([
    supabase.from("shows").select("id").eq("id", showId).eq("organization_id", workspace.organization.id).eq("partner_user_id", workspace.user.id).eq("status", "planned").is("archived_at", null).maybeSingle(),
    supabase.from("performances").select("id").eq("show_id", showId).gte("starts_at", new Date().toISOString()).limit(1).maybeSingle(),
  ]);
  if (!show) redirect(showsError("Show not found."));
  if (futurePerformance) redirect(showsError("Delete or move this show’s future performances before archiving it."));

  const { data: archived, error } = await supabase.from("shows")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", showId)
    .eq("organization_id", workspace.organization.id)
    .eq("partner_user_id", workspace.user.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error || !archived) redirect(showsError("Could not archive the show."));

  revalidatePath("/shows");
  revalidatePath("/artists");
  revalidatePath("/hotels");
  revalidatePath("/calendar");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect("/shows?message=Show+archived");
}

export async function restoreShow(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(showsError("Only partners can restore shows."));
  const showId = String(formData.get("show_id") ?? "");
  if (!showId) redirect(showsError("Show not found."));

  const supabase = await createSupabaseServerClient();
  const { data: restored, error } = await supabase.from("shows")
    .update({ archived_at: null })
    .eq("id", showId)
    .eq("organization_id", workspace.organization.id)
    .eq("partner_user_id", workspace.user.id)
    .eq("status", "planned")
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error || !restored) redirect(showsError("Could not restore the show."));

  revalidatePath("/shows");
  revalidatePath("/artists");
  revalidatePath("/hotels");
  revalidatePath("/calendar");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect("/shows?message=Show+restored");
}
