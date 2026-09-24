begin;

do $$
declare
  v_finance_definition text;
  v_create_definition text;
begin
  assert not has_function_privilege('authenticated', 'public.finish_show_v1(uuid)', 'execute'),
    'application users must not have access to a manual show finish action';

  assert exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'update_performance_v1'
  ), 'future performances need an update function';

  assert exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'performances'
      and policyname = 'partners update own planned show performances'
      and qual like '%now()%'
  ), 'updates must be limited to future performances';

  assert exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'performances'
      and policyname = 'partners delete own planned show performances'
      and qual like '%now()%'
  ), 'deletes must be limited to future performances';

  select pg_get_functiondef(procedure.oid)
  into v_create_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_performance_v1';

  assert v_create_definition like '%performance must be in the future%',
    'new performances must be future calendar entries';

  select pg_get_functiondef(procedure.oid)
  into v_finance_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'calculate_month_v1'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_organization_id uuid, p_month date';

  assert v_finance_definition like '%coalesce(performance.ends_at, performance.starts_at) <= now()%',
    'monthly finance must include performances automatically after they end';
  assert v_finance_definition not like '%show_row.status = ''finished''%',
    'monthly finance must not depend on a show-level lifecycle';
end;
$$;

rollback;
