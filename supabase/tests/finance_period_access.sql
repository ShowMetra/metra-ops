begin;

do $$
declare
  v_month_definition text;
  v_period_definition text;
begin
  select pg_get_functiondef(procedure.oid)
  into v_month_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'calculate_month_v1'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_organization_id uuid, p_month date';

  assert v_month_definition like '%organization_members%',
    'monthly finance must require active organization membership';
  assert v_month_definition like '%show_row.partner_user_id = v_user_id%',
    'partner finance must be limited to assigned shows';

  select pg_get_functiondef(procedure.oid)
  into v_period_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'calculate_finance_period_v1'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_organization_id uuid, p_start_month date, p_end_month date';

  assert v_period_definition like '%finance period cannot exceed 24 months%',
    'finance periods must be bounded';
  assert not has_function_privilege('anon', 'public.calculate_finance_period_v1(uuid,date,date)', 'execute'),
    'anonymous users must not access finance';
  assert has_function_privilege('authenticated', 'public.calculate_finance_period_v1(uuid,date,date)', 'execute'),
    'signed-in organization members need finance access';
end;
$$;

rollback;
