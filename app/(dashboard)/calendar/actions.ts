"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const calendarError = (message: string) => `/calendar?error=${encodeURIComponent(message)}`;

export async function createPerformance(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect(calendarError("Only partners can create performances."));
  const showId = String(formData.get("show_id") ?? "");
  const hotelId = String(formData.get("hotel_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const durationMinutes = Number(formData.get("duration_minutes"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!showId || !hotelId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    redirect(calendarError("Complete the required performance fields."));
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: show }, { data: hotel }] = await Promise.all([
    supabase.from("shows").select("id").eq("id", showId).eq("organization_id", workspace.organization.id).eq("partner_user_id", workspace.user.id).eq("status", "planned").maybeSingle(),
    supabase.from("hotels").select("id").eq("id", hotelId).eq("organization_id", workspace.organization.id).eq("status", "active").maybeSingle(),
  ]);
  if (!show || !hotel) redirect(calendarError("Choose an available show and hotel."));

  const { error } = await supabase.rpc("create_performance_v1", {
    p_organization_id: workspace.organization.id,
    p_show_id: showId,
    p_hotel_id: hotelId,
    p_local_start: `${date} ${time}:00`,
    p_duration_minutes: durationMinutes,
    p_notes: notes || null,
  });
  if (error) redirect(calendarError("Could not create the performance."));

  revalidatePath("/calendar");
  revalidatePath("/shows");
  revalidatePath("/dashboard");
  redirect("/calendar?message=Performance+created");
}
