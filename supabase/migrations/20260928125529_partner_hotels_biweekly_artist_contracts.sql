-- Hotels belong to the shared organization directory, but partners maintain it.
drop policy if exists "owner creates hotels" on public.hotels;
create policy "partners create hotels"
on public.hotels for insert to authenticated
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

-- A recurring series may also run every other week.
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
  if p_frequency not in ('daily', 'weekly', 'biweekly', 'monthly') then
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
      when 'biweekly' then p_local_start + make_interval(weeks => v_index * 2)
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

-- Contract periods let the same artist move between monthly and daily pay.
do $$
begin
  create type public.artist_payment_type as enum ('monthly', 'daily');
exception
  when duplicate_object then null;
end
$$;

alter table public.artist_contracts
  add column if not exists payment_type public.artist_payment_type not null default 'monthly',
  add column if not exists daily_rate numeric(12,2) not null default 0;

alter table public.artist_contracts
  drop constraint if exists artist_contracts_daily_rate_check,
  add constraint artist_contracts_daily_rate_check check (daily_rate >= 0),
  drop constraint if exists artist_contracts_payment_terms_check,
  add constraint artist_contracts_payment_terms_check check (
    (payment_type = 'monthly' and daily_rate = 0)
    or
    (payment_type = 'daily' and daily_rate > 0 and monthly_salary = 0 and extra_day_rate = 0)
  );

create extension if not exists btree_gist with schema extensions;

alter table public.artist_contracts
  drop constraint if exists artist_contracts_no_overlapping_periods,
  add constraint artist_contracts_no_overlapping_periods
  exclude using gist (
    show_id with =,
    artist_id with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  );

create or replace function public.create_artist_with_contract_v2(
  p_organization_id uuid,
  p_show_id uuid,
  p_full_name text,
  p_artist_code text default null,
  p_payment_type public.artist_payment_type default 'monthly',
  p_monthly_salary numeric default 0,
  p_extra_day_rate numeric default 0,
  p_daily_rate numeric default 0,
  p_currency text default 'EUR',
  p_valid_from date default current_date,
  p_valid_to date default null
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
  if p_valid_to is not null and p_valid_to < p_valid_from then
    raise exception 'contract end must not be before its start';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency';
  end if;
  if p_payment_type = 'monthly' and (p_monthly_salary < 0 or p_extra_day_rate < 0 or p_daily_rate <> 0) then
    raise exception 'invalid monthly contract rates';
  end if;
  if p_payment_type = 'daily' and (p_daily_rate <= 0 or p_monthly_salary <> 0 or p_extra_day_rate <> 0) then
    raise exception 'invalid daily contract rate';
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
  ) returning id into v_artist_id;

  insert into public.show_artists (
    organization_id, show_id, artist_id, valid_from, valid_to
  ) values (
    p_organization_id, p_show_id, v_artist_id, p_valid_from, null
  );

  insert into public.artist_contracts (
    organization_id, show_id, artist_id, payment_type,
    monthly_salary, extra_day_rate, daily_rate, currency, valid_from, valid_to
  ) values (
    p_organization_id, p_show_id, v_artist_id, p_payment_type,
    p_monthly_salary, p_extra_day_rate, p_daily_rate, p_currency, p_valid_from, p_valid_to
  );

  return v_artist_id;
end;
$$;

revoke all on function public.create_artist_with_contract_v2(
  uuid, uuid, text, text, public.artist_payment_type, numeric, numeric, numeric, text, date, date
) from public, anon;
grant execute on function public.create_artist_with_contract_v2(
  uuid, uuid, text, text, public.artist_payment_type, numeric, numeric, numeric, text, date, date
) to authenticated;

create or replace function public.create_artist_contract_v1(
  p_organization_id uuid,
  p_show_id uuid,
  p_artist_id uuid,
  p_payment_type public.artist_payment_type,
  p_monthly_salary numeric default 0,
  p_extra_day_rate numeric default 0,
  p_daily_rate numeric default 0,
  p_currency text default 'EUR',
  p_valid_from date default current_date,
  p_valid_to date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1
    from public.organization_members member
    join public.shows show_row
      on show_row.id = p_show_id
     and show_row.organization_id = member.organization_id
     and show_row.partner_user_id = member.user_id
     and show_row.status = 'planned'
    join public.artists artist
      on artist.id = p_artist_id
     and artist.organization_id = member.organization_id
     and artist.partner_user_id = member.user_id
    join public.show_artists cast_row
      on cast_row.show_id = show_row.id
     and cast_row.artist_id = artist.id
    where member.organization_id = p_organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner'
      and member.status = 'active'
  ) then
    raise exception 'artist and show access required';
  end if;
  if p_valid_to is not null and p_valid_to < p_valid_from then
    raise exception 'contract end must not be before its start';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency';
  end if;
  if p_payment_type = 'monthly' and (p_monthly_salary < 0 or p_extra_day_rate < 0 or p_daily_rate <> 0) then
    raise exception 'invalid monthly contract rates';
  end if;
  if p_payment_type = 'daily' and (p_daily_rate <= 0 or p_monthly_salary <> 0 or p_extra_day_rate <> 0) then
    raise exception 'invalid daily contract rate';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_show_id::text || ':' || p_artist_id::text, 0)
  );

  update public.artist_contracts
  set valid_to = p_valid_from - 1
  where organization_id = p_organization_id
    and show_id = p_show_id
    and artist_id = p_artist_id
    and valid_from < p_valid_from
    and valid_to is null;

  insert into public.artist_contracts (
    organization_id, show_id, artist_id, payment_type,
    monthly_salary, extra_day_rate, daily_rate, currency, valid_from, valid_to
  ) values (
    p_organization_id, p_show_id, p_artist_id, p_payment_type,
    p_monthly_salary, p_extra_day_rate, p_daily_rate, p_currency, p_valid_from, p_valid_to
  ) returning id into v_contract_id;

  return v_contract_id;
end;
$$;

revoke all on function public.create_artist_contract_v1(
  uuid, uuid, uuid, public.artist_payment_type, numeric, numeric, numeric, text, date, date
) from public, anon;
grant execute on function public.create_artist_contract_v1(
  uuid, uuid, uuid, public.artist_payment_type, numeric, numeric, numeric, text, date, date
) to authenticated;

-- Finance uses the contract that is active on each performance date.
create or replace function private.calculate_month_mode_v1(
  p_organization_id uuid,
  p_month date,
  p_include_future boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next_month date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_timezone text;
  v_user_id uuid := (select auth.uid());
  v_role public.member_role;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;

  select member.role
  into v_role
  from public.organization_members member
  where member.organization_id = p_organization_id
    and member.user_id = v_user_id
    and member.status = 'active';

  if v_role is null then raise exception 'organization member access required'; end if;

  select organization.timezone
  into v_timezone
  from public.organizations organization
  where organization.id = p_organization_id;

  with scheduled as (
    select performance.*, (performance.starts_at at time zone v_timezone)::date as work_date
    from public.performances performance
    join public.shows show_row
      on show_row.id = performance.show_id
     and show_row.organization_id = performance.organization_id
    where performance.organization_id = p_organization_id
      and (v_role = 'owner' or show_row.partner_user_id = v_user_id)
      and performance.status in ('planned', 'completed')
      and (p_include_future or coalesce(performance.ends_at, performance.starts_at) <= now())
      and (performance.starts_at at time zone v_timezone)::date >= v_month
      and (performance.starts_at at time zone v_timezone)::date < v_next_month
  ), revenue_lines as (
    select scheduled.hotel_id, scheduled.show_id, scheduled.id as performance_id, scheduled.work_date,
      rate.price_per_performance is null as rate_missing,
      greatest(coalesce(rate.price_per_performance, 0) - scheduled.billing_discount, 0) as amount
    from scheduled
    left join lateral (
      select hotel_rate.price_per_performance
      from public.hotel_show_rates hotel_rate
      where hotel_rate.hotel_id = scheduled.hotel_id
        and hotel_rate.show_id = scheduled.show_id
        and hotel_rate.valid_from <= scheduled.work_date
        and (hotel_rate.valid_to is null or hotel_rate.valid_to >= scheduled.work_date)
      order by hotel_rate.valid_from desc
      limit 1
    ) rate on true
  ), contract_work as (
    select contract.id as contract_id, contract.artist_id, contract.show_id,
      contract.payment_type, contract.monthly_salary, contract.extra_day_rate, contract.daily_rate,
      public.required_work_days(v_month, contract.required_days_override) as required_days,
      count(distinct scheduled.work_date) filter (where cast_row.id is not null)::integer as worked_days
    from public.artist_contracts contract
    join scheduled on scheduled.show_id = contract.show_id
      and scheduled.work_date >= contract.valid_from
      and (contract.valid_to is null or scheduled.work_date <= contract.valid_to)
    left join public.show_artists cast_row
      on cast_row.show_id = contract.show_id
     and cast_row.artist_id = contract.artist_id
     and scheduled.work_date >= cast_row.valid_from
     and (cast_row.valid_to is null or scheduled.work_date <= cast_row.valid_to)
    where contract.organization_id = p_organization_id
      and contract.valid_from < v_next_month
      and (contract.valid_to is null or contract.valid_to >= v_month)
    group by contract.id
  ), payroll_base as (
    select contract_work.artist_id, contract_work.show_id,
      sum(contract_work.worked_days)::integer as worked_days,
      sum(greatest(contract_work.worked_days - contract_work.required_days, 0))::integer as extra_days,
      sum(
        case contract_work.payment_type
          when 'daily' then contract_work.worked_days * contract_work.daily_rate
          else contract_work.monthly_salary
            + greatest(contract_work.worked_days - contract_work.required_days, 0) * contract_work.extra_day_rate
        end
      ) as base_pay
    from contract_work
    group by contract_work.artist_id, contract_work.show_id
  ), adjustment_totals as (
    select adjustment.artist_id, adjustment.show_id,
      coalesce(sum(adjustment.amount) filter (where adjustment.type = 'deduction'), 0) as deductions,
      coalesce(sum(adjustment.amount) filter (where adjustment.type in ('reimbursement', 'bonus')), 0) as additions
    from public.artist_adjustments adjustment
    where adjustment.organization_id = p_organization_id
      and adjustment.month = v_month
      and exists (select 1 from scheduled where scheduled.show_id = adjustment.show_id)
    group by adjustment.artist_id, adjustment.show_id
  ), artist_reimbursements as (
    select expense.paid_by_artist_id as artist_id, expense.show_id,
      coalesce(sum(expense.amount), 0) as amount
    from public.expenses expense
    where expense.organization_id = p_organization_id
      and expense.status = 'approved'
      and expense.paid_by = 'artist'
      and expense.expense_date >= v_month
      and expense.expense_date < v_next_month
      and exists (select 1 from scheduled where scheduled.show_id = expense.show_id)
    group by expense.paid_by_artist_id, expense.show_id
  ), payroll as (
    select payroll_base.*,
      coalesce(artist_reimbursements.amount, 0) as reimbursements,
      payroll_base.base_pay
        - coalesce(adjustment_totals.deductions, 0)
        + coalesce(adjustment_totals.additions, 0)
        + coalesce(artist_reimbursements.amount, 0) as payout
    from payroll_base
    left join adjustment_totals
      on adjustment_totals.artist_id = payroll_base.artist_id
     and adjustment_totals.show_id = payroll_base.show_id
    left join artist_reimbursements
      on artist_reimbursements.artist_id = payroll_base.artist_id
     and artist_reimbursements.show_id = payroll_base.show_id
  ), commission_work as (
    select rule.id as rule_id, rule.partner_user_id, rule.show_id,
      rule.base_monthly_commission, rule.extra_day_rate,
      public.required_work_days(v_month, rule.required_days_override) as required_days,
      count(distinct scheduled.work_date)::integer as worked_days
    from public.partner_commission_rules rule
    join scheduled on scheduled.show_id = rule.show_id
      and scheduled.work_date >= rule.valid_from
      and (rule.valid_to is null or scheduled.work_date <= rule.valid_to)
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
    join public.shows show_row on show_row.id = expense.show_id
    where expense.organization_id = p_organization_id
      and expense.status = 'approved'
      and expense.paid_by = 'partner'
      and expense.expense_date >= v_month
      and expense.expense_date < v_next_month
      and exists (select 1 from scheduled where scheduled.show_id = expense.show_id)
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
    where expense.organization_id = p_organization_id
      and expense.expense_date >= v_month
      and expense.expense_date < v_next_month
      and exists (select 1 from scheduled where scheduled.show_id = expense.show_id)
  )
  select jsonb_build_object(
    'month', v_month,
    'performanceCount', (select count(*) from scheduled),
    'unratedPerformances', (select count(*) from revenue_lines where rate_missing),
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

revoke all on function private.calculate_month_mode_v1(uuid, date, boolean)
from public, anon, authenticated;
