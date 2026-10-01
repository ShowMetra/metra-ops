begin;

do $$
declare
  v_policy text;
begin
  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shows'
      and column_name = 'archived_at'
  ), 'shows must expose an archive timestamp';

  assert exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'hotels'
      and column_name = 'status'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ), 'authenticated users need column-scoped hotel archive access';

  assert exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'artists'
      and column_name = 'status'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ), 'authenticated users need column-scoped artist archive access';

  assert exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.hotels'::regclass
      and trigger_row.tgname = 'prevent_hotel_archive_with_future_performances'
      and not trigger_row.tgisinternal
  ), 'hotel archive must be blocked while future performances exist';

  select with_check
  into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'shows'
    and policyname = 'partners create own planned shows'
    and cmd = 'INSERT';

  assert lower(v_policy) like '%archived_at is null%',
    'new shows must not be created as archived';

  select qual
  into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'expenses'
    and policyname = 'members delete removable expenses'
    and cmd = 'DELETE';

  assert lower(v_policy) like '%draft%'
    and lower(v_policy) like '%rejected%'
    and lower(v_policy) not like '%approved%',
    'only draft and rejected expenses may be deleted';

  assert not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expenses'
      and policyname = 'owner deletes expenses'
  ), 'the unrestricted owner expense delete policy must be removed';
end;
$$;

rollback;
