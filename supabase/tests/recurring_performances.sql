begin;

do $$
declare
  v_definition text;
  v_security_definer boolean;
begin
  select pg_get_functiondef(procedure.oid), procedure.prosecdef
  into v_definition, v_security_definer
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_recurring_performances_v1';

  assert not v_security_definer,
    'recurring performance creation must respect RLS';
  assert lower(v_definition) like '%show_row.partner_user_id = (select auth.uid())%',
    'partners may only create recurring performances for assigned shows';
  assert lower(v_definition) like '%recurring series cannot exceed one year%',
    'recurring series must be bounded';
  assert lower(v_definition) like '%when ''biweekly'' then p_local_start + make_interval(weeks => v_index * 2)%',
    'recurring performance creation must support every two weeks';
  assert not has_function_privilege(
    'anon',
    'public.create_recurring_performances_v1(uuid,uuid,uuid,timestamp without time zone,integer,text,date,text)',
    'execute'
  ), 'anonymous users must not create recurring performances';
  assert has_function_privilege(
    'authenticated',
    'public.create_recurring_performances_v1(uuid,uuid,uuid,timestamp without time zone,integer,text,date,text)',
    'execute'
  ), 'signed-in partners need recurring performance access';
end;
$$;

rollback;
