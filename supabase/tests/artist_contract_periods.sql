begin;

do $$
declare
  v_constraint_count integer;
  v_contract_definition text;
  v_security_definer boolean;
begin
  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_contracts'
      and column_name = 'payment_type'
  ), 'artist contracts need a payment type';

  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_contracts'
      and column_name = 'daily_rate'
  ), 'artist contracts need a daily rate';

  select count(*)
  into v_constraint_count
  from pg_constraint constraint_row
  join pg_class table_row on table_row.oid = constraint_row.conrelid
  join pg_namespace namespace on namespace.oid = table_row.relnamespace
  where namespace.nspname = 'public'
    and table_row.relname = 'artist_contracts'
    and constraint_row.conname = 'artist_contracts_no_overlapping_periods'
    and constraint_row.contype = 'x';

  assert v_constraint_count = 1,
    'contracts for the same artist and show must not overlap';

  select pg_get_functiondef(procedure.oid), procedure.prosecdef
  into v_contract_definition, v_security_definer
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_artist_contract_v1';

  assert lower(v_contract_definition) like '%member.role = ''partner''%',
    'only partners may create artist contracts';
  assert lower(v_contract_definition) like '%set valid_to = p_valid_from - 1%',
    'a later contract must close the previous open contract';
  assert not v_security_definer,
    'contract creation must respect table privileges and RLS';
  assert not has_function_privilege(
    'anon',
    'public.create_artist_contract_v1(uuid,uuid,uuid,public.artist_payment_type,numeric,numeric,numeric,text,date,date)',
    'execute'
  ), 'anonymous users must not create artist contracts';
  assert has_function_privilege(
    'authenticated',
    'public.create_artist_contract_v1(uuid,uuid,uuid,public.artist_payment_type,numeric,numeric,numeric,text,date,date)',
    'execute'
  ), 'signed-in partners need contract creation access';
end;
$$;

rollback;
