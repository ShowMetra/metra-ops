alter table public.shows
  add column color text;

with ranked_shows as (
  select
    id,
    row_number() over (partition by organization_id order by created_at, id) as color_position
  from public.shows
), assigned_colors as (
  select
    id,
    case color_position
      when 1 then '#157AAD'
      when 2 then '#D4557A'
      when 3 then '#E28A2B'
      when 4 then '#2E9B75'
      when 5 then '#7656C9'
      when 6 then '#C7563B'
      when 7 then '#2E8FA3'
      when 8 then '#9B6A3A'
      when 9 then '#5B75C9'
      when 10 then '#B552A1'
      when 11 then '#6B8F3D'
      when 12 then '#D06F42'
      when 13 then '#3D8E95'
      when 14 then '#8B5FBF'
      when 15 then '#B08A2E'
      when 16 then '#4F7C60'
      else '#' || upper(substr(md5(id::text), 1, 6))
    end as color
  from ranked_shows
)
update public.shows as shows
set color = assigned_colors.color
from assigned_colors
where assigned_colors.id = shows.id;

alter table public.shows
  alter column color set not null,
  add constraint shows_color_format_check check (color ~ '^#[0-9A-F]{6}$'),
  add constraint shows_organization_color_key unique (organization_id, color);

create or replace function private.assign_show_color_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_palette constant text[] := array[
    '#157AAD', '#D4557A', '#E28A2B', '#2E9B75',
    '#7656C9', '#C7563B', '#2E8FA3', '#9B6A3A',
    '#5B75C9', '#B552A1', '#6B8F3D', '#D06F42',
    '#3D8E95', '#8B5FBF', '#B08A2E', '#4F7C60'
  ];
  v_attempt integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.organization_id::text, 0));

  if new.color is not null then
    new.color := upper(new.color);
    return new;
  end if;

  select palette.color
  into new.color
  from unnest(v_palette) with ordinality as palette(color, position)
  where not exists (
    select 1
    from public.shows
    where shows.organization_id = new.organization_id
      and shows.color = palette.color
  )
  order by palette.position
  limit 1;

  while new.color is null loop
    new.color := '#' || upper(substr(md5(new.id::text || ':' || v_attempt::text), 1, 6));
    if not exists (
      select 1
      from public.shows
      where shows.organization_id = new.organization_id
        and shows.color = new.color
    ) then
      exit;
    end if;
    new.color := null;
    v_attempt := v_attempt + 1;
  end loop;

  return new;
end;
$$;

revoke all on function private.assign_show_color_v1() from public, anon, authenticated;

create trigger assign_show_color
before insert on public.shows
for each row execute function private.assign_show_color_v1();
