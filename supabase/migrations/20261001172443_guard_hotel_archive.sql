create or replace function private.prevent_hotel_archive_with_future_performances_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active'
    and new.status = 'inactive'
    and exists (
      select 1
      from public.performances performance
      where performance.hotel_id = old.id
        and coalesce(performance.ends_at, performance.starts_at) > now()
    )
  then
    raise exception 'hotel has future performances' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_hotel_archive_with_future_performances_v1()
from public, anon, authenticated;

drop trigger if exists prevent_hotel_archive_with_future_performances
on public.hotels;

create trigger prevent_hotel_archive_with_future_performances
before update of status on public.hotels
for each row
execute function private.prevent_hotel_archive_with_future_performances_v1();
