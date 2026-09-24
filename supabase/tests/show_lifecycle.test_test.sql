begin;

do $$
declare
  v_labels text[];
  v_default text;
  v_finance_definition text;
begin
  select array_agg(enum_value.enumlabel order by enum_value.enumsortorder)
  into v_labels
  from pg_type enum_type
  join pg_enum enum_value on enum_value.enumtypid = enum_type.oid
  join pg_namespace namespace on namespace.oid = enum_type.typnamespace
  where namespace.nspname = 'public'
    and enum_type.typname = 'show_status';

  assert v_labels = array['planned', 'finished'],
    'show_status must contain only planned and finished';

  select pg_get_expr(attribute_default.adbin, attribute_default.adrelid)
  into v_default
  from pg_attribute attribute
  join pg_class relation on relation.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  join pg_attrdef attribute_default
    on attribute_default.adrelid = attribute.attrelid
   and attribute_default.adnum = attribute.attnum
  where namespace.nspname = 'public'
    and relation.relname = 'shows'
    and attribute.attname = 'status';

  assert v_default like '%planned%',
    'new shows must default to planned';

  assert exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'finish_show_v1'
  ), 'finish_show_v1 must exist';

  assert exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shows'
      and policyname = 'partners update own planned shows'
  ), 'planned shows need a partner update policy';

  assert exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shows'
      and policyname = 'partners delete own planned shows'
  ), 'planned shows need a partner delete policy';

  select pg_get_functiondef(procedure.oid)
  into v_finance_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'calculate_month_v1'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_organization_id uuid, p_month date';

  assert v_finance_definition like '%show_row.status = ''finished''%',
    'monthly finance must include finished shows only';
end;
$$;

rollback;
