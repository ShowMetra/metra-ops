-- Explicit Data API privileges. RLS remains the authorization boundary.
grant select on table
  public.hotels,
  public.shows,
  public.artists,
  public.show_artists,
  public.artist_contracts,
  public.hotel_show_rates,
  public.performances,
  public.expenses,
  public.schedule_share_links,
  public.organization_invitations
to authenticated;

grant insert on table
  public.hotels,
  public.shows,
  public.artists,
  public.show_artists,
  public.artist_contracts,
  public.hotel_show_rates,
  public.performances,
  public.expenses
to authenticated;

create index if not exists shows_partner_user_id_idx
  on public.shows (partner_user_id);
create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);
create index if not exists artists_partner_user_id_idx
  on public.artists (partner_user_id);
create index if not exists show_artists_artist_id_idx
  on public.show_artists (artist_id);
create index if not exists show_artists_organization_id_idx
  on public.show_artists (organization_id);
create index if not exists artist_contracts_artist_id_idx
  on public.artist_contracts (artist_id);
create index if not exists artist_contracts_organization_id_idx
  on public.artist_contracts (organization_id);
create index if not exists hotel_show_rates_show_id_idx
  on public.hotel_show_rates (show_id);
create index if not exists hotel_show_rates_organization_id_idx
  on public.hotel_show_rates (organization_id);
create index if not exists performances_hotel_id_idx
  on public.performances (hotel_id);
create index if not exists performances_created_by_idx
  on public.performances (created_by);
create index if not exists performances_rescheduled_to_id_idx
  on public.performances (rescheduled_to_id);
create index if not exists expenses_show_id_idx
  on public.expenses (show_id);
create index if not exists expenses_organization_date_idx
  on public.expenses (organization_id, expense_date desc);
create index if not exists expenses_created_by_idx
  on public.expenses (created_by);
create index if not exists expenses_paid_by_artist_id_idx
  on public.expenses (paid_by_artist_id);
create index if not exists expenses_performance_id_idx
  on public.expenses (performance_id);
create index if not exists expenses_reviewed_by_idx
  on public.expenses (reviewed_by);

drop policy if exists "owner manages hotels" on public.hotels;
create policy "owner creates hotels"
on public.hotels for insert to authenticated
with check (public.is_org_owner(organization_id));

drop policy if exists "owner or assigned partner manages shows" on public.shows;
create policy "partners create own shows"
on public.shows for insert to authenticated
with check (
  partner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members member
    where member.organization_id = shows.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  )
);

drop policy if exists "owner or partner manages artists" on public.artists;
create policy "partners create own artists"
on public.artists for insert to authenticated
with check (
  partner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members member
    where member.organization_id = artists.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  )
);

drop policy if exists "show managers manage show artists" on public.show_artists;
create policy "show managers create show artists"
on public.show_artists for insert to authenticated
with check (
  exists (
    select 1
    from public.shows show_row
    join public.artists artist on artist.id = show_artists.artist_id
    join public.organization_members member
      on member.organization_id = show_artists.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = show_artists.show_id
      and show_row.organization_id = show_artists.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and artist.organization_id = show_artists.organization_id
      and artist.partner_user_id = (select auth.uid())
  )
);

drop policy if exists "show managers manage artist contracts" on public.artist_contracts;
create policy "show managers create artist contracts"
on public.artist_contracts for insert to authenticated
with check (
  exists (
    select 1
    from public.shows show_row
    join public.artists artist on artist.id = artist_contracts.artist_id
    join public.organization_members member
      on member.organization_id = artist_contracts.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = artist_contracts.show_id
      and show_row.organization_id = artist_contracts.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and artist.organization_id = artist_contracts.organization_id
      and artist.partner_user_id = (select auth.uid())
  )
);

drop policy if exists "show managers manage hotel rates" on public.hotel_show_rates;
create policy "show managers create hotel rates"
on public.hotel_show_rates for insert to authenticated
with check (
  exists (
    select 1
    from public.shows show_row
    join public.hotels hotel on hotel.id = hotel_show_rates.hotel_id
    join public.organization_members member
      on member.organization_id = hotel_show_rates.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = hotel_show_rates.show_id
      and show_row.organization_id = hotel_show_rates.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and hotel.organization_id = hotel_show_rates.organization_id
  )
);

drop policy if exists "partner creates open expenses for own shows" on public.expenses;
create policy "partner creates open expenses for own shows"
on public.expenses for insert to authenticated
with check (
  created_by = (select auth.uid())
  and status in ('draft', 'submitted')
  and performance_id is null
  and paid_by_artist_id is null
  and paid_by in ('partner', 'company')
  and reviewed_by is null
  and reviewed_at is null
  and rejection_reason is null
  and public.is_month_open(organization_id, expense_date)
  and exists (
    select 1
    from public.shows show_row
    join public.organization_members member
      on member.organization_id = expenses.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = expenses.show_id
      and show_row.organization_id = expenses.organization_id
      and show_row.partner_user_id = (select auth.uid())
  )
);

drop policy if exists "owner creates expenses" on public.expenses;

drop policy if exists "show managers create performances" on public.performances;
create policy "partners create own show performances"
on public.performances for insert to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'planned'
  and billing_discount = 0
  and cancellation_financials is null
  and rescheduled_to_id is null
  and public.is_timestamp_month_open(organization_id, starts_at)
  and exists (
    select 1
    from public.shows show_row
    join public.hotels hotel on hotel.id = performances.hotel_id
    join public.organization_members member
      on member.organization_id = performances.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = performances.show_id
      and show_row.organization_id = performances.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and hotel.organization_id = performances.organization_id
      and hotel.status = 'active'
  )
);

create or replace function public.create_artist_with_contract_v1(
  p_organization_id uuid,
  p_show_id uuid,
  p_full_name text,
  p_artist_code text default null,
  p_monthly_salary numeric default 0,
  p_extra_day_rate numeric default 0,
  p_currency text default 'EUR',
  p_valid_from date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_artist_id uuid;
  v_partner_user_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
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
  if nullif(trim(p_full_name), '') is null then
    raise exception 'artist name is required';
  end if;
  if p_monthly_salary < 0 or p_extra_day_rate < 0 then
    raise exception 'rates cannot be negative';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency';
  end if;

  select show_row.partner_user_id
  into v_partner_user_id
  from public.shows show_row
  where show_row.id = p_show_id
    and show_row.organization_id = p_organization_id;

  if v_partner_user_id is null then
    raise exception 'show not found';
  end if;
  if v_partner_user_id <> (select auth.uid()) then
    raise exception 'show access required';
  end if;

  insert into public.artists (
    organization_id, partner_user_id, full_name, artist_code
  ) values (
    p_organization_id,
    v_partner_user_id,
    trim(p_full_name),
    nullif(upper(trim(p_artist_code)), '')
  )
  returning id into v_artist_id;

  insert into public.show_artists (
    organization_id, show_id, artist_id, valid_from
  ) values (
    p_organization_id, p_show_id, v_artist_id, p_valid_from
  );

  insert into public.artist_contracts (
    organization_id,
    show_id,
    artist_id,
    monthly_salary,
    extra_day_rate,
    currency,
    valid_from
  ) values (
    p_organization_id,
    p_show_id,
    v_artist_id,
    p_monthly_salary,
    p_extra_day_rate,
    p_currency,
    p_valid_from
  );

  return v_artist_id;
end;
$$;

revoke all on function public.create_artist_with_contract_v1(
  uuid, uuid, text, text, numeric, numeric, text, date
) from public, anon;
grant execute on function public.create_artist_with_contract_v1(
  uuid, uuid, text, text, numeric, numeric, text, date
) to authenticated;

create or replace function public.create_performance_v1(
  p_organization_id uuid,
  p_show_id uuid,
  p_hotel_id uuid,
  p_local_start timestamp without time zone,
  p_duration_minutes integer default 60,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_performance_id uuid;
  v_timezone text;
  v_start timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
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
  if p_duration_minutes < 15 or p_duration_minutes > 480 then
    raise exception 'duration must be between 15 and 480 minutes';
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
      and hotel.organization_id = p_organization_id
      and hotel.status = 'active'
  ) then
    raise exception 'show and hotel must belong to the organization';
  end if;

  v_start := p_local_start at time zone v_timezone;

  insert into public.performances (
    organization_id,
    show_id,
    hotel_id,
    starts_at,
    ends_at,
    operational_notes,
    created_by
  ) values (
    p_organization_id,
    p_show_id,
    p_hotel_id,
    v_start,
    v_start + make_interval(mins => p_duration_minutes),
    nullif(trim(p_notes), ''),
    (select auth.uid())
  )
  returning id into v_performance_id;

  return v_performance_id;
end;
$$;

revoke all on function public.create_performance_v1(
  uuid, uuid, uuid, timestamp without time zone, integer, text
) from public, anon;
grant execute on function public.create_performance_v1(
  uuid, uuid, uuid, timestamp without time zone, integer, text
) to authenticated;
