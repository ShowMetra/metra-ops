-- Preserve operational and financial history by archiving core records instead
-- of deleting them. Expenses remain hard-deletable only while they are not part
-- of the approved/submitted audit trail.

alter table public.shows
  add column if not exists archived_at timestamptz;

create index if not exists shows_organization_archived_idx
  on public.shows (organization_id, archived_at);

grant update (status) on table public.hotels to authenticated;
grant update (archived_at) on table public.shows to authenticated;
grant update (status) on table public.artists to authenticated;
grant delete on table public.expenses to authenticated;

drop policy if exists "partners archive hotels" on public.hotels;
create policy "partners archive hotels"
on public.hotels for update to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = hotels.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = hotels.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  )
);

drop policy if exists "partners archive own artists" on public.artists;
create policy "partners archive own artists"
on public.artists for update to authenticated
using (
  partner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members member
    where member.organization_id = artists.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  )
)
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

drop policy if exists "partners create own planned shows" on public.shows;
create policy "partners create own planned shows"
on public.shows for insert to authenticated
with check (
  status = 'planned'
  and finished_at is null
  and archived_at is null
  and partner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members member
    where member.organization_id = shows.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  )
);

drop policy if exists "show managers create show artists" on public.show_artists;
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
      and show_row.status = 'planned'
      and show_row.archived_at is null
      and artist.organization_id = show_artists.organization_id
      and artist.partner_user_id = (select auth.uid())
      and artist.status = 'active'
  )
);

drop policy if exists "show managers create artist contracts" on public.artist_contracts;
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
      and show_row.status = 'planned'
      and show_row.archived_at is null
      and artist.organization_id = artist_contracts.organization_id
      and artist.partner_user_id = (select auth.uid())
      and artist.status = 'active'
  )
);

drop policy if exists "show managers create hotel rates" on public.hotel_show_rates;
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
      and show_row.status = 'planned'
      and show_row.archived_at is null
      and hotel.organization_id = hotel_show_rates.organization_id
      and hotel.status = 'active'
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
      and show_row.status = 'planned'
      and show_row.archived_at is null
  )
);

drop policy if exists "partner edits expenses for own planned shows" on public.expenses;
create policy "partner edits expenses for own planned shows"
on public.expenses for update to authenticated
using (
  created_by = (select auth.uid())
  and status in ('draft', 'submitted')
  and public.is_month_open(organization_id, expense_date)
  and exists (
    select 1
    from public.shows show_row
    where show_row.id = expenses.show_id
      and show_row.organization_id = expenses.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and show_row.archived_at is null
  )
)
with check (
  created_by = (select auth.uid())
  and status in ('draft', 'submitted')
  and public.is_month_open(organization_id, expense_date)
  and exists (
    select 1
    from public.shows show_row
    where show_row.id = expenses.show_id
      and show_row.organization_id = expenses.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and show_row.archived_at is null
  )
);

drop policy if exists "partners create own show performances" on public.performances;
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
      and show_row.status = 'planned'
      and show_row.archived_at is null
      and hotel.organization_id = performances.organization_id
      and hotel.status = 'active'
  )
);

drop policy if exists "partners update own planned show performances" on public.performances;
create policy "partners update own planned show performances"
on public.performances for update to authenticated
using (
  public.is_timestamp_month_open(organization_id, starts_at)
  and exists (
    select 1
    from public.shows show_row
    join public.organization_members member
      on member.organization_id = performances.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = performances.show_id
      and show_row.organization_id = performances.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and show_row.archived_at is null
  )
)
with check (
  public.is_timestamp_month_open(organization_id, starts_at)
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
      and show_row.status = 'planned'
      and show_row.archived_at is null
      and hotel.organization_id = performances.organization_id
      and hotel.status = 'active'
  )
);

drop policy if exists "partners delete own planned show performances" on public.performances;
create policy "partners delete own planned show performances"
on public.performances for delete to authenticated
using (
  public.is_timestamp_month_open(organization_id, starts_at)
  and exists (
    select 1
    from public.shows show_row
    join public.organization_members member
      on member.organization_id = performances.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = performances.show_id
      and show_row.organization_id = performances.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and show_row.archived_at is null
  )
);

drop policy if exists "owner deletes expenses" on public.expenses;
drop policy if exists "members delete removable expenses" on public.expenses;
create policy "members delete removable expenses"
on public.expenses for delete to authenticated
using (
  status in ('draft', 'rejected')
  and public.is_month_open(organization_id, expense_date)
  and (
    public.is_org_owner(organization_id)
    or (
      created_by = (select auth.uid())
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
    )
  )
);
