"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const hotelsError = (message: string) => `/hotels?error=${encodeURIComponent(message)}`;

export async function createHotel(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "owner") redirect(hotelsError("Only the owner can create hotels."));

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const billingName = String(formData.get("billing_name") ?? "").trim();
  const billingEmail = String(formData.get("billing_email") ?? "").trim().toLowerCase();
  const taxId = String(formData.get("tax_id") ?? "").trim();
  if (name.length < 2) redirect(hotelsError("Enter a hotel name."));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("hotels").insert({
    organization_id: workspace.organization.id,
    name,
    address: address || null,
    billing_name: billingName || null,
    billing_email: billingEmail || null,
    tax_id: taxId || null,
  });
  if (error?.code === "23505") redirect(hotelsError("This hotel already exists."));
  if (error) redirect(hotelsError("Could not create the hotel."));

  revalidatePath("/hotels");
  redirect("/hotels?message=Hotel+created");
}

export async function createHotelRate(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(hotelsError("Only partners can create hotel rates."));
  const hotelId = String(formData.get("hotel_id") ?? "");
  const showId = String(formData.get("show_id") ?? "");
  const price = Number(formData.get("price_per_performance"));
  const validFrom = String(formData.get("valid_from") ?? "");
  if (!hotelId || !showId || !Number.isFinite(price) || price < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
    redirect(hotelsError("Complete the required rate fields."));
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: hotel }, { data: show }] = await Promise.all([
    supabase.from("hotels").select("id").eq("id", hotelId).eq("organization_id", workspace.organization.id).maybeSingle(),
    supabase.from("shows").select("id").eq("id", showId).eq("organization_id", workspace.organization.id).eq("partner_user_id", workspace.user.id).eq("status", "planned").maybeSingle(),
  ]);
  if (!hotel || !show) redirect(hotelsError("Choose an available hotel and show."));

  const { error } = await supabase.from("hotel_show_rates").insert({
    organization_id: workspace.organization.id,
    hotel_id: hotelId,
    show_id: showId,
    price_per_performance: price,
    currency: workspace.organization.baseCurrency,
    valid_from: validFrom,
  });
  if (error?.code === "23505") redirect(hotelsError("A rate already starts on this date."));
  if (error) redirect(hotelsError("Could not create the hotel rate."));

  revalidatePath("/hotels");
  redirect("/hotels?message=Hotel+rate+created");
}
