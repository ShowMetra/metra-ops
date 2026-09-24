"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const artistsError = (message: string) => `/artists?error=${encodeURIComponent(message)}`;

export async function createArtist(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(artistsError("Only partners can create artists."));
  const showId = String(formData.get("show_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const artistCode = String(formData.get("artist_code") ?? "").trim();
  const monthlySalary = Number(formData.get("monthly_salary"));
  const extraDayRate = Number(formData.get("extra_day_rate"));
  const validFrom = String(formData.get("valid_from") ?? "");

  if (!showId || fullName.length < 2 || !Number.isFinite(monthlySalary) || monthlySalary < 0 || !Number.isFinite(extraDayRate) || extraDayRate < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
    redirect(artistsError("Complete the required artist and contract fields."));
  }

  const supabase = await createSupabaseServerClient();
  const { data: show } = await supabase
    .from("shows")
    .select("id")
    .eq("id", showId)
    .eq("organization_id", workspace.organization.id)
    .eq("partner_user_id", workspace.user.id)
    .eq("status", "planned")
    .maybeSingle();
  if (!show) redirect(artistsError("Choose an available show."));

  const { error } = await supabase.rpc("create_artist_with_contract_v1", {
    p_organization_id: workspace.organization.id,
    p_show_id: showId,
    p_full_name: fullName,
    p_artist_code: artistCode || null,
    p_monthly_salary: monthlySalary,
    p_extra_day_rate: extraDayRate,
    p_currency: workspace.organization.baseCurrency,
    p_valid_from: validFrom,
  });
  if (error?.code === "23505") redirect(artistsError("This artist code is already in use."));
  if (error) redirect(artistsError("Could not create the artist and contract."));

  revalidatePath("/artists");
  revalidatePath("/shows");
  redirect("/artists?message=Artist+and+contract+created");
}
