create type public.show_status as enum ('planned', 'finished');

alter table public.shows
  alter column status drop default;

alter table public.shows
  alter column status type public.show_status
  using (
    case status::text
      when 'inactive' then 'finished'
      else 'planned'
    end
  )::public.show_status;

alter table public.shows
  alter column status set default 'planned';

alter table public.shows
  add column finished_at timestamptz;

update public.shows
set finished_at = coalesce(updated_at, now())
where status = 'finished';

alter table public.shows
  add constraint shows_finished_at_matches_status_check
  check (
    (status = 'planned' and finished_at is null)
    or (status = 'finished' and finished_at is not null)
  );

create index shows_organization_status_idx
  on public.shows (organization_id, status);

revoke update, delete on table public.shows from authenticated;
grant update (name, code, description, updated_at)
on table public.shows to authenticated;
grant delete on table public.shows to authenticated;

drop policy if exists "partners create own shows" on public.shows;
create policy "partners create own planned shows"
on public.shows for insert to authenticated
with check (
  status = 'planned'
  and finished_at is null
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

create policy "partners update own planned shows"
on public.shows for update to authenticated
using (
  status = 'planned'
  and partner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members member
    where member.organization_id = shows.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  )
)
with check (
  status = 'planned'
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

create policy "partners delete own planned shows"
on public.shows for delete to authenticated
using (
  status = 'planned'
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
      and artist.organization_id = show_artists.organization_id
      and artist.partner_user_id = (select auth.uid())
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
      and artist.organization_id = artist_contracts.organization_id
      and artist.partner_user_id = (select auth.uid())
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
      and show_row.status = 'planned'
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
      and hotel.organization_id = performances.organization_id
      and hotel.status = 'active'
  )
);

drop policy if exists "show managers update open performances" on public.performances;
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
  )
)
with check (
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
  )
);

drop policy if exists "show managers delete open performances" on public.performances;
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
  )
);

drop policy if exists "partner edits own open expenses" on public.expenses;
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
    and show_row.organization_id = p_organization_id
    and show_row.status = 'planned';

  if v_partner_user_id is null then
    raise exception 'planned show not found';
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
      and show_row.status = 'planned'
      and hotel.organization_id = p_organization_id
      and hotel.status = 'active'
  ) then
    raise exception 'planned show and active hotel must belong to the organization';
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

create or replace function public.finish_show_v1(p_show_id uuid)
returns public.shows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show public.shows;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  select *
  into v_show
  from public.shows show_row
  where show_row.id = p_show_id
  for update;

  if v_show.id is null then
    raise exception 'show not found';
  end if;
  if v_show.partner_user_id <> (select auth.uid()) or not exists (
    select 1
    from public.organization_members member
    where member.organization_id = v_show.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  ) then
    raise exception 'partner access required';
  end if;
  if v_show.status = 'finished' then
    raise exception 'show is already finished';
  end if;
  if not exists (
    select 1
    from public.performances performance
    where performance.show_id = v_show.id
  ) then
    raise exception 'add at least one performance before finishing the show';
  end if;
  if exists (
    select 1
    from public.performances performance
    where performance.show_id = v_show.id
      and performance.status = 'planned'
      and coalesce(performance.ends_at, performance.starts_at) > now()
  ) then
    raise exception 'show still has future performances';
  end if;
  if exists (
    select 1
    from public.performances performance
    where performance.show_id = v_show.id
      and performance.status in ('planned', 'completed')
      and not public.is_timestamp_month_open(v_show.organization_id, performance.starts_at)
  ) then
    raise exception 'a performance month is already closed';
  end if;

  update public.performances
  set status = 'completed', updated_at = now()
  where show_id = v_show.id
    and status = 'planned'
    and coalesce(ends_at, starts_at) <= now();

  update public.shows
  set status = 'finished', finished_at = now(), updated_at = now()
  where id = v_show.id
  returning * into v_show;

  return v_show;
end;
$$;

revoke all on function public.finish_show_v1(uuid) from public, anon;
grant execute on function public.finish_show_v1(uuid) to authenticated;

create or replace function public.calculate_month_v1(p_organization_id uuid, p_month date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next_month date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_timezone text;
  v_result jsonb;
begin
  if not public.is_org_owner(p_organization_id) then raise exception 'owner access required'; end if;
  select timezone into v_timezone from public.organizations where id = p_organization_id;

  with completed as (
    select performance.*, (performance.starts_at at time zone v_timezone)::date as work_date
    from public.performances performance
    join public.shows show_row
      on show_row.id = performance.show_id
     and show_row.status = 'finished'
    where performance.organization_id = p_organization_id
      and performance.status = 'completed'
      and (performance.starts_at at time zone v_timezone)::date >= v_month
      and (performance.starts_at at time zone v_timezone)::date < v_next_month
  ), revenue_lines as (
    select completed.hotel_id, completed.show_id, completed.id as performance_id, completed.work_date,
      greatest(coalesce(rate.price_per_performance, 0) - completed.billing_discount, 0) as amount
    from completed
    left join lateral (
      select hotel_rate.price_per_performance
      from public.hotel_show_rates hotel_rate
      where hotel_rate.hotel_id = completed.hotel_id
        and hotel_rate.show_id = completed.show_id
        and hotel_rate.valid_from <= completed.work_date
        and (hotel_rate.valid_to is null or hotel_rate.valid_to >= completed.work_date)
      order by hotel_rate.valid_from desc limit 1
    ) rate on true
  ), contract_work as (
    select contract.id as contract_id, contract.artist_id, contract.show_id,
      contract.monthly_salary, contract.extra_day_rate,
      public.required_work_days(v_month, contract.required_days_override) as required_days,
      count(distinct completed.work_date) filter (where cast_row.id is not null)::integer as worked_days
    from public.artist_contracts contract
    join public.shows show_row
      on show_row.id = contract.show_id
     and show_row.status = 'finished'
    left join completed on completed.show_id = contract.show_id
      and completed.work_date >= contract.valid_from
      and (contract.valid_to is null or completed.work_date <= contract.valid_to)
    left join public.show_artists cast_row
      on cast_row.show_id = contract.show_id
     and cast_row.artist_id = contract.artist_id
     and completed.work_date >= cast_row.valid_from
     and (cast_row.valid_to is null or completed.work_date <= cast_row.valid_to)
    where contract.organization_id = p_organization_id
      and contract.valid_from < v_next_month
      and (contract.valid_to is null or contract.valid_to >= v_month)
    group by contract.id
  ), adjustment_totals as (
    select adjustment.artist_id, adjustment.show_id,
      coalesce(sum(adjustment.amount) filter (where adjustment.type = 'deduction'), 0) as deductions,
      coalesce(sum(adjustment.amount) filter (where adjustment.type in ('reimbursement', 'bonus')), 0) as additions
    from public.artist_adjustments adjustment
    join public.shows show_row
      on show_row.id = adjustment.show_id
     and show_row.status = 'finished'
    where adjustment.organization_id = p_organization_id
      and adjustment.month = v_month
    group by adjustment.artist_id, adjustment.show_id
  ), artist_reimbursements as (
    select expense.paid_by_artist_id as artist_id, expense.show_id,
      coalesce(sum(expense.amount), 0) as amount
    from public.expenses expense
    join public.shows show_row
      on show_row.id = expense.show_id
     and show_row.status = 'finished'
    where expense.organization_id = p_organization_id
      and expense.status = 'approved'
      and expense.paid_by = 'artist'
      and expense.expense_date >= v_month
      and expense.expense_date < v_next_month
    group by expense.paid_by_artist_id, expense.show_id
  ), payroll as (
    select contract_work.*,
      greatest(contract_work.worked_days - contract_work.required_days, 0) as extra_days,
      coalesce(artist_reimbursements.amount, 0) as reimbursements,
      contract_work.monthly_salary
        + greatest(contract_work.worked_days - contract_work.required_days, 0) * contract_work.extra_day_rate
        - coalesce(adjustment_totals.deductions, 0)
        + coalesce(adjustment_totals.additions, 0)
        + coalesce(artist_reimbursements.amount, 0) as payout
    from contract_work
    left join adjustment_totals
      on adjustment_totals.artist_id = contract_work.artist_id
     and adjustment_totals.show_id = contract_work.show_id
    left join artist_reimbursements
      on artist_reimbursements.artist_id = contract_work.artist_id
     and artist_reimbursements.show_id = contract_work.show_id
  ), commission_work as (
    select rule.id as rule_id, rule.partner_user_id, rule.show_id,
      rule.base_monthly_commission, rule.extra_day_rate,
      public.required_work_days(v_month, rule.required_days_override) as required_days,
      count(distinct completed.work_date)::integer as worked_days
    from public.partner_commission_rules rule
    join public.shows show_row
      on show_row.id = rule.show_id
     and show_row.status = 'finished'
    left join completed on completed.show_id = rule.show_id
      and completed.work_date >= rule.valid_from
      and (rule.valid_to is null or completed.work_date <= rule.valid_to)
    where rule.organization_id = p_organization_id
      and rule.valid_from < v_next_month
      and (rule.valid_to is null or rule.valid_to >= v_month)
    group by rule.id
  ), commissions as (
    select commission_work.*,
      greatest(worked_days - required_days, 0) as extra_days,
      base_monthly_commission + greatest(worked_days - required_days, 0) * extra_day_rate as total
    from commission_work
  ), partner_reimbursements as (
    select show_row.partner_user_id, expense.show_id,
      coalesce(sum(expense.amount), 0) as amount
    from public.expenses expense
    join public.shows show_row
      on show_row.id = expense.show_id
     and show_row.status = 'finished'
    where expense.organization_id = p_organization_id
      and expense.status = 'approved'
      and expense.paid_by = 'partner'
      and expense.expense_date >= v_month
      and expense.expense_date < v_next_month
    group by show_row.partner_user_id, expense.show_id
  ), commission_payouts as (
    select commissions.*, coalesce(partner_reimbursements.amount, 0) as reimbursements,
      commissions.total + coalesce(partner_reimbursements.amount, 0) as payout
    from commissions
    left join partner_reimbursements
      on partner_reimbursements.partner_user_id = commissions.partner_user_id
     and partner_reimbursements.show_id = commissions.show_id
  ), expense_totals as (
    select
      coalesce(sum(expense.amount) filter (where expense.status = 'approved'), 0) as approved,
      coalesce(sum(expense.amount) filter (where expense.status = 'submitted'), 0) as awaiting_approval
    from public.expenses expense
    join public.shows show_row
      on show_row.id = expense.show_id
     and show_row.status = 'finished'
    where expense.organization_id = p_organization_id
      and expense.expense_date >= v_month
      and expense.expense_date < v_next_month
  )
  select jsonb_build_object(
    'month', v_month,
    'revenue', coalesce((select sum(amount) from revenue_lines), 0),
    'payroll', coalesce((select sum(payout - reimbursements) from payroll), 0),
    'commissions', coalesce((select sum(total) from commission_payouts), 0),
    'approvedExpenses', (select approved from expense_totals),
    'awaitingExpenseApproval', (select awaiting_approval from expense_totals),
    'profit', coalesce((select sum(amount) from revenue_lines), 0)
      - coalesce((select sum(payout - reimbursements) from payroll), 0)
      - coalesce((select sum(total) from commission_payouts), 0)
      - (select approved from expense_totals),
    'revenueLines', coalesce((select jsonb_agg(to_jsonb(line)) from revenue_lines line), '[]'::jsonb),
    'payrollLines', coalesce((select jsonb_agg(to_jsonb(line)) from payroll line), '[]'::jsonb),
    'commissionLines', coalesce((select jsonb_agg(to_jsonb(line)) from commission_payouts line), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
