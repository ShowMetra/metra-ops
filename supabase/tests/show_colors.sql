begin;

do $$
begin
  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shows'
      and column_name = 'color'
      and is_nullable = 'NO'
  ), 'shows must have a required color';

  assert exists (
    select 1
    from pg_constraint
    where conrelid = 'public.shows'::regclass
      and conname = 'shows_organization_color_key'
      and contype = 'u'
  ), 'show colors must be unique within an organization';

  assert exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.shows'::regclass
      and tgname = 'assign_show_color'
      and not tgisinternal
  ), 'new shows must receive a color automatically';

  assert not exists (
    select organization_id, color
    from public.shows
    group by organization_id, color
    having count(*) > 1
  ), 'existing show colors must be unique within each organization';
end;
$$;

rollback;
