"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const calendarError = (message: string) => `/calendar?error=${encodeURIComponent(message)}`;

function performanceInput(formData: FormData) {
  const performanceId = String(formData.get("performance_id") ?? "");
  const showId = String(formData.get("show_id") ?? "");
  const hotelId = String(formData.get("hotel_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const durationMinutes = Number(formData.get("duration_minutes"));
  const notes = String(formData.get("notes") ?? "").trim();
  const valid = Boolean(showId && hotelId && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) && Number.isInteger(durationMinutes) && durationMinutes >= 15 && durationMinutes <= 480);
  return { performanceId, showId, hotelId, date, time, durationMinutes, notes, valid };
}

const refreshCalendar = () => {
  revalidatePath("/calendar");
  revalidatePath("/shows");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
};

export async function createPerformance(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(calendarError("Only partners can create performances."));
  const input = performanceInput(formData);
  if (!input.valid) redirect(calendarError("Complete the required performance fields."));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_performance_v1", {
    p_organization_id: workspace.organization.id,
    p_show_id: input.showId,
    p_hotel_id: input.hotelId,
    p_local_start: `${input.date} ${input.time}:00`,
    p_duration_minutes: input.durationMinutes,
    p_notes: input.notes || null,
  });
  if (error?.message.includes("future")) redirect(calendarError("A new performance must be in the future."));
  if (error) redirect(calendarError("Could not create the performance."));

  refreshCalendar();
  redirect("/calendar?message=Performance+created");
}

export async function updatePerformance(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(calendarError("Only partners can update performances."));
  const input = performanceInput(formData);
  if (!input.performanceId || !input.valid) redirect(calendarError("Complete the required performance fields."));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_performance_v1", {
    p_performance_id: input.performanceId,
    p_show_id: input.showId,
    p_hotel_id: input.hotelId,
    p_local_start: `${input.date} ${input.time}:00`,
    p_duration_minutes: input.durationMinutes,
    p_notes: input.notes || null,
  });
  if (error?.message.includes("finished")) redirect(calendarError("Finished performances cannot be changed."));
  if (error?.message.includes("future")) redirect(calendarError("A planned performance must stay in the future."));
  if (error) redirect(calendarError("Could not update the performance."));

  refreshCalendar();
  redirect("/calendar?message=Performance+updated");
}

export async function deletePerformance(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(calendarError("Only partners can delete performances."));
  const performanceId = String(formData.get("performance_id") ?? "");
  if (!performanceId) redirect(calendarError("Performance not found."));

  const supabase = await createSupabaseServerClient();
  const { data: performance } = await supabase.from("performances")
    .select("id, ends_at, starts_at, shows!inner(partner_user_id)")
    .eq("id", performanceId)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  const show = Array.isArray(performance?.shows) ? performance.shows[0] : performance?.shows;
  if (!performance || show?.partner_user_id !== workspace.user.id) redirect(calendarError("Performance not found."));
  if (new Date(performance.ends_at || performance.starts_at).getTime() <= Date.now()) redirect(calendarError("Finished performances cannot be deleted."));

  const { data: deleted, error } = await supabase.from("performances").delete().eq("id", performanceId).select("id").maybeSingle();
  if (error || !deleted) redirect(calendarError("Could not delete the performance."));

  refreshCalendar();
  redirect("/calendar?message=Performance+deleted");
}
