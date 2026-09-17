import { createSupabasePublicClient } from "@/lib/supabase/public";

export type PublicSchedule = {
  show: { id: string; name: string };
  performances: Array<{
    id: string;
    startsAt: string;
    endsAt: string | null;
    status: string;
    hotel: string;
    address: string | null;
    notes: string | null;
  }>;
};

export async function getPublicSchedule(token: string): Promise<PublicSchedule | null> {
  const supabase = createSupabasePublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_public_schedule_v1", { p_token: token });
  if (error || !data) return null;
  return data as PublicSchedule;
}
