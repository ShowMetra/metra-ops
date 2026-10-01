"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const artistsError = (message: string) => `/artists?error=${encodeURIComponent(message)}`;

type ContractInput = {
  paymentType: "monthly" | "daily";
  monthlySalary: number;
  extraDayRate: number;
  dailyRate: number;
  validFrom: string;
  validTo: string | null;
  valid: boolean;
};

function contractInput(formData: FormData): ContractInput {
  const paymentType = String(formData.get("payment_type") ?? "monthly") as ContractInput["paymentType"];
  const monthlySalary = Number(formData.get("monthly_salary"));
  const extraDayRate = Number(formData.get("extra_day_rate"));
  const dailyRate = Number(formData.get("daily_rate"));
  const validFrom = String(formData.get("valid_from") ?? "");
  const validToValue = String(formData.get("valid_to") ?? "");
  const validTo = validToValue || null;
  const validDates = /^\d{4}-\d{2}-\d{2}$/.test(validFrom)
    && (!validTo || (/^\d{4}-\d{2}-\d{2}$/.test(validTo) && validTo >= validFrom));
  const validRates = paymentType === "monthly"
    ? Number.isFinite(monthlySalary) && monthlySalary >= 0 && Number.isFinite(extraDayRate) && extraDayRate >= 0
    : paymentType === "daily" && Number.isFinite(dailyRate) && dailyRate > 0;
  return {
    paymentType,
    monthlySalary: paymentType === "monthly" ? monthlySalary : 0,
    extraDayRate: paymentType === "monthly" ? extraDayRate : 0,
    dailyRate: paymentType === "daily" ? dailyRate : 0,
    validFrom,
    validTo,
    valid: validDates && validRates,
  };
}

export async function createArtist(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(artistsError("Only partners can create artists."));
  const showId = String(formData.get("show_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const artistCode = String(formData.get("artist_code") ?? "").trim();
  const contract = contractInput(formData);

  if (!showId || fullName.length < 2 || !contract.valid) {
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
    .is("archived_at", null)
    .maybeSingle();
  if (!show) redirect(artistsError("Choose an available show."));

  const { error } = await supabase.rpc("create_artist_with_contract_v2", {
    p_organization_id: workspace.organization.id,
    p_show_id: showId,
    p_full_name: fullName,
    p_artist_code: artistCode || null,
    p_payment_type: contract.paymentType,
    p_monthly_salary: contract.monthlySalary,
    p_extra_day_rate: contract.extraDayRate,
    p_daily_rate: contract.dailyRate,
    p_currency: workspace.organization.baseCurrency,
    p_valid_from: contract.validFrom,
    p_valid_to: contract.validTo,
  });
  if (error?.code === "23505") redirect(artistsError("This artist code is already in use."));
  if (error) redirect(artistsError("Could not create the artist and contract."));

  revalidatePath("/artists");
  revalidatePath("/shows");
  redirect("/artists?message=Artist+and+contract+created");
}

export async function createArtistContract(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(artistsError("Only partners can create artist contracts."));
  const artistId = String(formData.get("artist_id") ?? "");
  const showId = String(formData.get("show_id") ?? "");
  const contract = contractInput(formData);
  if (!artistId || !showId || !contract.valid) redirect(artistsError("Complete the required contract fields."));

  const supabase = await createSupabaseServerClient();
  const [{ data: artist }, { data: show }] = await Promise.all([
    supabase.from("artists").select("id").eq("id", artistId).eq("organization_id", workspace.organization.id).eq("partner_user_id", workspace.user.id).eq("status", "active").maybeSingle(),
    supabase.from("shows").select("id").eq("id", showId).eq("organization_id", workspace.organization.id).eq("partner_user_id", workspace.user.id).eq("status", "planned").is("archived_at", null).maybeSingle(),
  ]);
  if (!artist || !show) redirect(artistsError("Choose one of your artists and shows."));

  const { error } = await supabase.rpc("create_artist_contract_v1", {
    p_organization_id: workspace.organization.id,
    p_show_id: showId,
    p_artist_id: artistId,
    p_payment_type: contract.paymentType,
    p_monthly_salary: contract.monthlySalary,
    p_extra_day_rate: contract.extraDayRate,
    p_daily_rate: contract.dailyRate,
    p_currency: workspace.organization.baseCurrency,
    p_valid_from: contract.validFrom,
    p_valid_to: contract.validTo,
  });
  if (error?.code === "23P01" || error?.code === "23505") redirect(artistsError("This contract overlaps another contract for the same show."));
  if (error) redirect(artistsError("Could not create the contract."));

  revalidatePath("/artists");
  revalidatePath("/finance");
  redirect("/artists?message=Contract+created");
}

export async function archiveArtist(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(artistsError("Only partners can archive artists."));
  const artistId = String(formData.get("artist_id") ?? "");
  if (!artistId) redirect(artistsError("Artist not found."));

  const supabase = await createSupabaseServerClient();
  const { data: archived, error } = await supabase.from("artists")
    .update({ status: "inactive" })
    .eq("id", artistId)
    .eq("organization_id", workspace.organization.id)
    .eq("partner_user_id", workspace.user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error || !archived) redirect(artistsError("Could not archive the artist."));

  revalidatePath("/artists");
  revalidatePath("/dashboard");
  redirect("/artists?message=Artist+archived");
}

export async function restoreArtist(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(artistsError("Only partners can restore artists."));
  const artistId = String(formData.get("artist_id") ?? "");
  if (!artistId) redirect(artistsError("Artist not found."));

  const supabase = await createSupabaseServerClient();
  const { data: restored, error } = await supabase.from("artists")
    .update({ status: "active" })
    .eq("id", artistId)
    .eq("organization_id", workspace.organization.id)
    .eq("partner_user_id", workspace.user.id)
    .eq("status", "inactive")
    .select("id")
    .maybeSingle();
  if (error || !restored) redirect(artistsError("Could not restore the artist."));

  revalidatePath("/artists");
  revalidatePath("/dashboard");
  redirect("/artists?message=Artist+restored");
}
