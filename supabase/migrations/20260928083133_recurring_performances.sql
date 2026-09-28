create or replace function public.create_recurring_performances_v1(
  p_organization_id uuid,
  p_show_id uuid,
  p_hotel_id uuid,
  p_local_start timestamp without time zone,
  p_duration_minutes integer,
  p_frequency text,
  p_repeat_until date,
  p_notes text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_occurrence_local timestamp without time zone;
  v_start timestamptz;
  v_index integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;
  if p_frequency not in ('daily', 'weekly', 'monthly') then
    raise exception 'unsupported recurrence frequency';
  end if;
  if p_duration_minutes < 15 or p_duration_minutes > 480 then
    raise exception 'duration must be between 15 and 480 minutes';
  end if;
  if p_repeat_until < p_local_start::date then
    raise exception 'repeat until must not be before the first performance';
  end if;
  if p_repeat_until > p_local_start::date + 365 then
    raise exception 'recurring series cannot exceed one year';
  end if;

  if not exists (
    select 1
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  ) then
    raise exception 'partner access required';
  end if;

  select organization.timezone
  into v_timezone
  from public.organizations organization
  where organization.id = p_organization_id;
  if v_timezone is null then
    raise exception 'organization not found';
  end if;

  if not exists (
    select 1
    from public.shows show_row
    join public.hotels hotel on hotel.id = p_hotel_id
    where show_row.id = p_show_id
      and show_row.organization_id = p_organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and hotel.organization_id = p_organization_id
      and hotel.status = 'active'
  ) then
    raise exception 'show and active hotel must belong to the organization';
  end if;

  loop
    v_occurrence_local := case p_frequency
      when 'daily' then p_local_start + make_interval(days => v_index)
      when 'weekly' then p_local_start + make_interval(weeks => v_index)
      when 'monthly' then p_local_start + make_interval(months => v_index)
    end;
    exit when v_occurrence_local::date > p_repeat_until;

    v_start := v_occurrence_local at time zone v_timezone;
    if v_start <= now() then
      raise exception 'every recurring performance must be in the future';
    end if;

    insert into public.performances (
      organization_id, show_id, hotel_id, starts_at, ends_at, operational_notes, created_by
    ) values (
      p_organization_id, p_show_id, p_hotel_id, v_start,
      v_start + make_interval(mins => p_duration_minutes),
      nullif(trim(p_notes), ''), (select auth.uid())
    );

    v_index := v_index + 1;
    if v_index > 366 then
      raise exception 'recurring series has too many performances';
    end if;
  end loop;

  return v_index;
end;
$$;

revoke all on function public.create_recurring_performances_v1(
  uuid, uuid, uuid, timestamp without time zone, integer, text, date, text
) from public, anon;
grant execute on function public.create_recurring_performances_v1(
  uuid, uuid, uuid, timestamp without time zone, integer, text, date, text
) to authenticated;
