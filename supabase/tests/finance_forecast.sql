begin;

do $$
declare
  v_helper_definition text;
  v_actual_definition text;
  v_forecast_definition text;
  v_period_definition text;
begin
  select pg_get_functiondef(procedure.oid)
  into v_helper_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private'
    and procedure.proname = 'calculate_month_mode_v1';

  assert v_helper_definition like '%p_include_future or coalesce(performance.ends_at, performance.starts_at) <= now()%',
    'forecast mode must include scheduled future performances while actual mode stays completed-only';
  assert v_helper_definition like '%show_row.partner_user_id = v_user_id%',
    'partner forecasts must stay limited to assigned shows';
  assert v_helper_definition like '%rate_missing%',
    'forecast must report performances without a matching hotel rate';
  assert not has_function_privilege(
    'authenticated',
    'private.calculate_month_mode_v1(uuid,date,boolean)',
    'execute'
  ), 'the internal finance helper must not be directly callable';

  select pg_get_functiondef(procedure.oid)
  into v_actual_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'calculate_month_v1';

  assert v_actual_definition like '%calculate_month_mode_v1(p_organization_id, p_month, false)%',
    'actual finance must use completed-only mode';

  select pg_get_functiondef(procedure.oid)
  into v_forecast_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'calculate_forecast_month_v1';

  assert v_forecast_definition like '%calculate_month_mode_v1(p_organization_id, p_month, true)%',
    'forecast finance must include scheduled performances';
  assert not has_function_privilege('anon', 'public.calculate_forecast_month_v1(uuid,date)', 'execute'),
    'anonymous users must not access forecasts';
  assert has_function_privilege('authenticated', 'public.calculate_forecast_month_v1(uuid,date)', 'execute'),
    'signed-in organization members need forecast access';

  select pg_get_functiondef(procedure.oid)
  into v_period_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'calculate_finance_forecast_period_v1';

  assert v_period_definition like '%finance period cannot exceed 24 months%',
    'forecast periods must be bounded';
  assert not has_function_privilege(
    'anon',
    'public.calculate_finance_forecast_period_v1(uuid,date,date)',
    'execute'
  ), 'anonymous users must not access forecast periods';
end;
$$;

rollback;
