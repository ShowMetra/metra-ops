-- RLS remains the authorization boundary; expose only the mutations used by the calendar.
grant update (show_id, hotel_id, starts_at, ends_at, operational_notes, updated_at)
on table public.performances to authenticated;

grant delete on table public.performances to authenticated;
