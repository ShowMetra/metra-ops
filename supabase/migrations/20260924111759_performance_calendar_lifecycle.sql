-- Planned/Finished is a performance lifecycle derived from time, not a show lifecycle.
-- Keep the legacy function for migration compatibility, but remove application access.
revoke execute on function public.finish_show_v1(uuid) from authenticated;

alter policy "partners create own show performances"
on public.performances to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'planned'
  and billing_discount = 0
  and cancellation_financials is null
  and rescheduled_to_id is null
  and coalesce(ends_at, starts_at) > now()
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

alter policy "partners update own planned show performances"
on public.performances to authenticated
using (
  coalesce(ends_at, starts_at) > now()
  and public.is_timestamp_month_open(organization_id, starts_at)
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
  status = 'planned'
  and coalesce(ends_at, starts_at) > now()
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

alter policy "partners delete own planned show performances"
on public.performances to authenticated
using (
  coalesce(ends_at, starts_at) > now()
  and public.is_timestamp_month_open(organization_id, starts_at)
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
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'partner' and member.status = 'active'
  ) then raise exception 'partner access required'; end if;
  if p_duration_minutes < 15 or p_duration_minutes > 480 then
    raise exception 'duration must be between 15 and 480 minutes';
  end if;

  select organization.timezone into v_timezone
  from public.organizations organization where organization.id = p_organization_id;
  if v_timezone is null then raise exception 'organization not found'; end if;
  if not exists (
    select 1 from public.shows show_row
    join public.hotels hotel on hotel.id = p_hotel_id
    where show_row.id = p_show_id
      and show_row.organization_id = p_organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and hotel.organization_id = p_organization_id
      and hotel.status = 'active'
  ) then raise exception 'show and active hotel must belong to the organization'; end if;

  v_start := p_local_start at time zone v_timezone;
  if v_start <= now() then raise exception 'performance must be in the future'; end if;

  insert into public.performances (
    organization_id, show_id, hotel_id, starts_at, ends_at, operational_notes, created_by
  ) values (
    p_organization_id, p_show_id, p_hotel_id, v_start,
    v_start + make_interval(mins => p_duration_minutes),
    nullif(trim(p_notes), ''), (select auth.uid())
  ) returning id into v_performance_id;
  return v_performance_id;
end;
$$;

create or replace function public.update_performance_v1(
  p_performance_id uuid,
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
  v_organization_id uuid;
  v_timezone text;
  v_start timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_duration_minutes < 15 or p_duration_minutes > 480 then
    raise exception 'duration must be between 15 and 480 minutes';
  end if;

  select performance.organization_id into v_organization_id
  from public.performances performance
  join public.shows current_show on current_show.id = performance.show_id
  where performance.id = p_performance_id
    and current_show.partner_user_id = (select auth.uid())
    and coalesce(performance.ends_at, performance.starts_at) > now();
  if v_organization_id is null then raise exception 'finished performance cannot be changed'; end if;

  select organization.timezone into v_timezone
  from public.organizations organization where organization.id = v_organization_id;
  if not exists (
    select 1 from public.shows show_row
    join public.hotels hotel on hotel.id = p_hotel_id
    where show_row.id = p_show_id
      and show_row.organization_id = v_organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and hotel.organization_id = v_organization_id
      and hotel.status = 'active'
  ) then raise exception 'show and active hotel must belong to the organization'; end if;

  v_start := p_local_start at time zone v_timezone;
  if v_start <= now() then raise exception 'performance must stay in the future'; end if;

  update public.performances
  set show_id = p_show_id,
      hotel_id = p_hotel_id,
      starts_at = v_start,
      ends_at = v_start + make_interval(mins => p_duration_minutes),
      operational_notes = nullif(trim(p_notes), ''),
      updated_at = now()
  where id = p_performance_id;
  if not found then raise exception 'performance could not be updated'; end if;
  return p_performance_id;
end;
$$;

revoke all on function public.update_performance_v1(
  uuid, uuid, uuid, timestamp without time zone, integer, text
) from public, anon;
grant execute on function public.update_performance_v1(
  uuid, uuid, uuid, timestamp without time zone, integer, text
) to authenticated;

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
    where performance.organization_id = p_organization_id
      and performance.status in ('planned', 'completed')
      and coalesce(performance.ends_at, performance.starts_at) <= now()
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
    join completed on completed.show_id = contract.show_id
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
    where adjustment.organization_id = p_organization_id
      and adjustment.month = v_month
      and exists (select 1 from completed where completed.show_id = adjustment.show_id)
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
      and exists (select 1 from completed where completed.show_id = expense.show_id)
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
    join completed on completed.show_id = rule.show_id
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
    join public.shows show_row on show_row.id = expense.show_id
    where expense.organization_id = p_organization_id
      and expense.status = 'approved'
      and expense.paid_by = 'partner'
      and expense.expense_date >= v_month
      and expense.expense_date < v_next_month
      and exists (select 1 from completed where completed.show_id = expense.show_id)
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
      and exists (select 1 from completed where completed.show_id = expense.show_id)
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
