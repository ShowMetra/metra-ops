create or replace function public.calculate_month_v1(p_organization_id uuid, p_month date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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

  select timezone into v_timezone
  from public.organizations
  where id = p_organization_id;

  with completed as (
    select performance.*, (performance.starts_at at time zone v_timezone)::date as work_date
    from public.performances performance
    join public.shows show_row
      on show_row.id = performance.show_id
     and show_row.organization_id = performance.organization_id
    where performance.organization_id = p_organization_id
      and (v_role = 'owner' or show_row.partner_user_id = v_user_id)
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

revoke all on function public.calculate_month_v1(uuid, date) from public, anon;
grant execute on function public.calculate_month_v1(uuid, date) to authenticated;

create or replace function public.calculate_finance_period_v1(
  p_organization_id uuid,
  p_start_month date,
  p_end_month date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_start_month date := date_trunc('month', p_start_month)::date;
  v_end_month date := date_trunc('month', p_end_month)::date;
  v_result jsonb;
begin
  if v_start_month > v_end_month then
    raise exception 'start month must not be after end month';
  end if;
  if v_end_month >= (v_start_month + interval '24 months')::date then
    raise exception 'finance period cannot exceed 24 months';
  end if;

  with months as materialized (
    select month_value::date as month,
      public.calculate_month_v1(p_organization_id, month_value::date) as calculation
    from generate_series(
      v_start_month::timestamp,
      v_end_month::timestamp,
      interval '1 month'
    ) month_value
  ), revenue_lines as (
    select line.value
    from months
    cross join lateral jsonb_array_elements(months.calculation->'revenueLines') line
  )
  select jsonb_build_object(
    'startMonth', v_start_month,
    'endMonth', v_end_month,
    'revenue', coalesce(sum((calculation->>'revenue')::numeric), 0),
    'payroll', coalesce(sum((calculation->>'payroll')::numeric), 0),
    'commissions', coalesce(sum((calculation->>'commissions')::numeric), 0),
    'approvedExpenses', coalesce(sum((calculation->>'approvedExpenses')::numeric), 0),
    'awaitingExpenseApproval', coalesce(sum((calculation->>'awaitingExpenseApproval')::numeric), 0),
    'profit', coalesce(sum((calculation->>'profit')::numeric), 0),
    'monthlyLines', coalesce(jsonb_agg(
      jsonb_build_object(
        'month', month,
        'revenue', (calculation->>'revenue')::numeric,
        'payroll', (calculation->>'payroll')::numeric,
        'commissions', (calculation->>'commissions')::numeric,
        'approvedExpenses', (calculation->>'approvedExpenses')::numeric,
        'awaitingExpenseApproval', (calculation->>'awaitingExpenseApproval')::numeric,
        'profit', (calculation->>'profit')::numeric
      ) order by month
    ), '[]'::jsonb),
    'revenueLines', coalesce((select jsonb_agg(value) from revenue_lines), '[]'::jsonb)
  )
  into v_result
  from months;

  return v_result;
end;
$$;

revoke all on function public.calculate_finance_period_v1(uuid, date, date) from public, anon;
grant execute on function public.calculate_finance_period_v1(uuid, date, date) to authenticated;
