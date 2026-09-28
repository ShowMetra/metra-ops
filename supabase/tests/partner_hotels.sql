begin;

do $$
declare
  v_policy text;
begin
  select with_check
  into v_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'hotels'
    and policyname = 'partners create hotels'
    and cmd = 'INSERT';

  assert lower(v_policy) like '%member.role = ''partner''%',
    'hotel creation must require an active partner membership';
  assert not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hotels'
      and policyname = 'owner creates hotels'
  ), 'the owner-only hotel creation policy must be removed';
end;
$$;

rollback;
