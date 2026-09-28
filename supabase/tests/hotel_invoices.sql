begin;

do $$
declare
  v_function_definition text;
begin
  assert exists (
    select 1
    from pg_class table_row
    join pg_namespace namespace on namespace.oid = table_row.relnamespace
    where namespace.nspname = 'public'
      and table_row.relname = 'invoices'
      and table_row.relrowsecurity
  ), 'invoices must have RLS enabled';

  assert exists (
    select 1
    from pg_class table_row
    join pg_namespace namespace on namespace.oid = table_row.relnamespace
    where namespace.nspname = 'public'
      and table_row.relname = 'invoice_items'
      and table_row.relrowsecurity
  ), 'invoice items must have RLS enabled';

  assert has_table_privilege('authenticated', 'public.invoices', 'select'),
    'owners need invoice read access through RLS';
  assert not has_table_privilege('authenticated', 'public.invoices', 'insert'),
    'invoice creation must go through the guarded function';
  assert not has_table_privilege('anon', 'public.invoices', 'select'),
    'anonymous users must not read invoices';
  assert has_function_privilege(
    'authenticated',
    'public.create_hotel_invoice_v1(uuid,uuid,date)',
    'execute'
  ), 'authenticated owners need invoice generation access';
  assert not has_function_privilege(
    'anon',
    'public.create_hotel_invoice_v1(uuid,uuid,date)',
    'execute'
  ), 'anonymous users must not generate invoices';

  select pg_get_functiondef(procedure.oid)
  into v_function_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'create_hotel_invoice_v1'
    and pg_get_function_identity_arguments(procedure.oid) =
      'p_organization_id uuid, p_hotel_id uuid, p_billing_month date';

  assert v_function_definition like '%is_org_owner%',
    'invoice generation must require owner access';
  assert v_function_definition like '%rate_missing%',
    'invoice generation must reject unrated performances';
  assert exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.invoices'::regclass
      and constraint_row.contype = 'u'
      and pg_get_constraintdef(constraint_row.oid) like '%organization_id, hotel_id, billing_month%'
  ), 'one invoice per hotel and month must be enforced';
end;
$$;

rollback;
