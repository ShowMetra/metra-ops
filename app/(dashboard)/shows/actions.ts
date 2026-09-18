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
  });
  if (error?.code === "23505") redirect(showsError("A show with this name already exists."));
  if (error) redirect(showsError("Could not create the show."));

  revalidatePath("/shows");
  revalidatePath("/dashboard");
  redirect("/shows?message=Show+created");
}
