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

export async function updateShow(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(showsError("Only partners can update shows."));

  const showId = String(formData.get("show_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  if (!showId || name.length < 2) redirect(showsError("Enter a show name."));

  const supabase = await createSupabaseServerClient();
  const { data: show } = await supabase
    .from("shows")
    .select("id, status")
    .eq("id", showId)
    .eq("organization_id", workspace.organization.id)
    .eq("partner_user_id", workspace.user.id)
    .maybeSingle();
  if (!show) redirect(showsError("Show not found."));
  if (show.status !== "planned") redirect(showsError("Finished shows are locked."));

  const { data: updated, error } = await supabase
    .from("shows")
    .update({ name, code: code || null, description: description || null, updated_at: new Date().toISOString() })
    .eq("id", showId)
    .eq("status", "planned")
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") redirect(showsError("A show with this name already exists."));
  if (error || !updated) redirect(showsError("Could not update the show."));

  revalidatePath("/shows");
  revalidatePath("/dashboard");
  redirect("/shows?message=Show+updated");
}

export async function deleteShow(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(showsError("Only partners can delete shows."));

  const showId = String(formData.get("show_id") ?? "");
  const supabase = await createSupabaseServerClient();
  const { data: show } = await supabase
    .from("shows")
    .select("id, status")
    .eq("id", showId)
    .eq("organization_id", workspace.organization.id)
    .eq("partner_user_id", workspace.user.id)
    .maybeSingle();
  if (!show) redirect(showsError("Show not found."));
  if (show.status !== "planned") redirect(showsError("Finished shows cannot be deleted."));

  const { data: deleted, error } = await supabase
    .from("shows")
    .delete()
    .eq("id", showId)
    .eq("status", "planned")
    .select("id")
    .maybeSingle();
  if (error || !deleted) redirect(showsError("Could not delete the show."));

  revalidatePath("/shows");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  redirect("/shows?message=Show+deleted");
}

export async function finishShow(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(showsError("Only partners can finish shows."));

  const showId = String(formData.get("show_id") ?? "");
  if (!showId) redirect(showsError("Show not found."));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("finish_show_v1", { p_show_id: showId });
  if (error?.message.includes("future performances")) redirect(showsError("The show still has future performances."));
  if (error?.message.includes("at least one performance")) redirect(showsError("Add at least one performance before finishing the show."));
  if (error?.message.includes("month is already closed")) redirect(showsError("This show belongs to a closed financial month."));
  if (error) redirect(showsError("Could not finish the show."));

  revalidatePath("/shows");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/finance");
  redirect("/shows?message=Show+finished+and+added+to+monthly+finance");
}
