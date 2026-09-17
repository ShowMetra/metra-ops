create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'partner');
create type public.record_status as enum ('active', 'inactive');
create type public.performance_status as enum (
  'planned', 'completed', 'cancelled_by_hotel', 'cancelled_by_agency', 'rescheduled', 'no_show'
);
create type public.expense_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type public.expense_payer as enum ('company', 'partner', 'artist');
create type public.month_status as enum ('open', 'closed');
create type public.adjustment_type as enum ('deduction', 'reimbursement', 'bonus');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Europe/Athens',
  base_currency text not null default 'EUR' check (char_length(base_currency) = 3),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  billing_name text,
  billing_email text,
  tax_id text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  partner_user_id uuid not null references auth.users(id),
  name text not null,
  code text,
  description text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  partner_user_id uuid not null references auth.users(id),
  full_name text not null,
  artist_code text,
  account_name text,
  iban text,
  swift_code text,
  payment_notes text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, artist_code)
);

create table public.show_artists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  unique (show_id, artist_id, valid_from)
);

create table public.artist_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  monthly_salary numeric(12,2) not null check (monthly_salary >= 0),
  extra_day_rate numeric(12,2) not null default 0 check (extra_day_rate >= 0),
  required_days_override integer check (required_days_override between 0 and 31),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  unique (show_id, artist_id, valid_from)
);

create table public.hotel_show_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  price_per_performance numeric(12,2) not null check (price_per_performance >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  unique (hotel_id, show_id, valid_from)
);

create table public.partner_commission_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  partner_user_id uuid not null references auth.users(id),
  show_id uuid not null references public.shows(id) on delete cascade,
  base_monthly_commission numeric(12,2) not null default 0 check (base_monthly_commission >= 0),
  extra_day_rate numeric(12,2) not null default 0 check (extra_day_rate >= 0),
  required_days_override integer check (required_days_override between 0 and 31),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  unique (show_id, partner_user_id, valid_from)
);

create table public.performances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.performance_status not null default 'planned',
  billing_discount numeric(12,2) not null default 0 check (billing_discount >= 0),
  operational_notes text,
  cancellation_financials jsonb,
  rescheduled_to_id uuid references public.performances(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index performances_month_idx on public.performances (organization_id, starts_at);
create index performances_show_idx on public.performances (show_id, starts_at);

create table public.artist_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  type public.adjustment_type not null,
  amount numeric(12,2) not null check (amount >= 0),
  reason text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  performance_id uuid references public.performances(id) on delete set null,
  expense_date date not null,
  category text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  paid_by public.expense_payer not null,
  paid_by_artist_id uuid references public.artists(id),
  status public.expense_status not null default 'draft',
  rejection_reason text,
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((paid_by = 'artist' and paid_by_artist_id is not null) or paid_by <> 'artist')
);

create table public.expense_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table public.schedule_share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  token_hash text not null unique,
  is_active boolean not null default true,
  include_past_days integer not null default 7 check (include_past_days between 0 and 90),
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.partner_month_submissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  partner_user_id uuid not null references auth.users(id),
  month date not null check (month = date_trunc('month', month)::date),
  submitted_at timestamptz,
  reopened_at timestamptz,
  primary key (organization_id, partner_user_id, month)
);

create table public.monthly_closures (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  status public.month_status not null default 'open',
  financial_snapshot jsonb,
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (organization_id, month)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
      and m.status = 'active'
  );
$$;

create or replace function public.can_manage_show(p_show_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shows s
    where s.id = p_show_id
      and (public.is_org_owner(s.organization_id) or s.partner_user_id = auth.uid())
  );
$$;

create or replace function public.is_month_open(p_organization_id uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.monthly_closures mc
    where mc.organization_id = p_organization_id
      and mc.month = date_trunc('month', p_date)::date
      and mc.status = 'closed'
  );
$$;

create or replace function public.is_timestamp_month_open(p_organization_id uuid, p_timestamp timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_month_open(
    p_organization_id,
    (p_timestamp at time zone (select timezone from public.organizations where id = p_organization_id))::date
  );
$$;

create or replace function public.required_work_days(p_month date, p_override integer default null)
returns integer language sql immutable as $$
  select coalesce(
    p_override,
    extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::integer - 2
  );
$$;

create or replace function public.create_organization_v1(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'organization name is required'; end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid organization slug'; end if;

  insert into public.organizations (name, slug)
  values (trim(p_name), p_slug)
  returning id into v_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.hotels enable row level security;
alter table public.shows enable row level security;
alter table public.artists enable row level security;
alter table public.show_artists enable row level security;
alter table public.artist_contracts enable row level security;
alter table public.hotel_show_rates enable row level security;
alter table public.partner_commission_rules enable row level security;
alter table public.performances enable row level security;
alter table public.artist_adjustments enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_files enable row level security;
alter table public.schedule_share_links enable row level security;
alter table public.partner_month_submissions enable row level security;
alter table public.monthly_closures enable row level security;

create policy "profile self read" on public.profiles for select using (id = auth.uid());
create policy "profile self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members read organization" on public.organizations for select using (public.is_org_member(id));
create policy "owner updates organization" on public.organizations for update using (public.is_org_owner(id)) with check (public.is_org_owner(id));

create policy "members read memberships" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "owner manages memberships" on public.organization_members for all using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));

create policy "members read hotels" on public.hotels for select using (public.is_org_member(organization_id));
create policy "owner manages hotels" on public.hotels for all using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));

create policy "members read assigned shows" on public.shows for select using (
  public.is_org_owner(organization_id) or partner_user_id = auth.uid()
);
create policy "owner or assigned partner manages shows" on public.shows for all
using (public.is_org_owner(organization_id) or partner_user_id = auth.uid())
with check (public.is_org_owner(organization_id) or (partner_user_id = auth.uid() and public.is_org_member(organization_id)));

create policy "members read assigned artists" on public.artists for select using (
  public.is_org_owner(organization_id) or partner_user_id = auth.uid()
);
create policy "owner or partner manages artists" on public.artists for all
using (public.is_org_owner(organization_id) or partner_user_id = auth.uid())
with check (public.is_org_owner(organization_id) or (partner_user_id = auth.uid() and public.is_org_member(organization_id)));

create policy "show managers read show artists" on public.show_artists for select using (public.can_manage_show(show_id));
create policy "show managers manage show artists" on public.show_artists for all using (public.can_manage_show(show_id)) with check (public.can_manage_show(show_id));

create policy "show managers read artist contracts" on public.artist_contracts for select using (public.can_manage_show(show_id));
create policy "show managers manage artist contracts" on public.artist_contracts for all using (public.can_manage_show(show_id)) with check (public.can_manage_show(show_id));

create policy "show managers read hotel rates" on public.hotel_show_rates for select using (public.can_manage_show(show_id));
create policy "show managers manage hotel rates" on public.hotel_show_rates for all using (public.can_manage_show(show_id)) with check (public.can_manage_show(show_id));

create policy "show managers read commission rules" on public.partner_commission_rules for select using (public.can_manage_show(show_id));
create policy "partner manages own commission rules" on public.partner_commission_rules for all
using (public.is_org_owner(organization_id) or (partner_user_id = auth.uid() and public.can_manage_show(show_id)))
with check (public.is_org_owner(organization_id) or (partner_user_id = auth.uid() and public.can_manage_show(show_id)));

create policy "show managers read performances" on public.performances for select using (public.can_manage_show(show_id));
create policy "show managers create performances" on public.performances for insert
with check (public.can_manage_show(show_id) and public.is_timestamp_month_open(organization_id, starts_at));
create policy "show managers update open performances" on public.performances for update
using (public.can_manage_show(show_id) and public.is_timestamp_month_open(organization_id, starts_at))
with check (public.can_manage_show(show_id) and public.is_timestamp_month_open(organization_id, starts_at));
create policy "show managers delete open performances" on public.performances for delete
using (public.can_manage_show(show_id) and public.is_timestamp_month_open(organization_id, starts_at));

create policy "show managers read adjustments" on public.artist_adjustments for select using (
  public.is_org_owner(organization_id) or public.can_manage_show(show_id)
);
create policy "owner manages open adjustments" on public.artist_adjustments for all
using (public.is_org_owner(organization_id) and public.is_month_open(organization_id, month))
with check (public.is_org_owner(organization_id) and public.is_month_open(organization_id, month));

create policy "show managers read expenses" on public.expenses for select using (
  public.is_org_owner(organization_id) or public.can_manage_show(show_id)
);
create policy "partner creates open expenses for own shows" on public.expenses for insert with check (
  public.can_manage_show(show_id) and created_by = auth.uid()
  and status in ('draft', 'submitted') and public.is_month_open(organization_id, expense_date)
);
create policy "owner creates expenses" on public.expenses for insert with check (
  public.is_org_owner(organization_id) and public.is_month_open(organization_id, expense_date)
);
create policy "partner edits own open expenses" on public.expenses for update
using (
  created_by = auth.uid() and public.can_manage_show(show_id)
  and status in ('draft', 'submitted') and public.is_month_open(organization_id, expense_date)
)
with check (
  created_by = auth.uid() and public.can_manage_show(show_id)
  and status in ('draft', 'submitted') and public.is_month_open(organization_id, expense_date)
);
create policy "owner reviews expenses" on public.expenses for update
using (public.is_org_owner(organization_id) and public.is_month_open(organization_id, expense_date))
with check (public.is_org_owner(organization_id) and public.is_month_open(organization_id, expense_date));
create policy "owner deletes expenses" on public.expenses for delete using (public.is_org_owner(organization_id));

create policy "show managers read expense files" on public.expense_files for select using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and (public.is_org_owner(e.organization_id) or public.can_manage_show(e.show_id))
  )
);
create policy "show managers add expense files" on public.expense_files for insert with check (
  exists (select 1 from public.expenses e where e.id = expense_id and public.can_manage_show(e.show_id))
);
create policy "owner deletes expense files" on public.expense_files for delete using (public.is_org_owner(organization_id));

create policy "show managers read share links" on public.schedule_share_links for select using (public.can_manage_show(show_id));
create policy "show managers manage share links" on public.schedule_share_links for all using (public.can_manage_show(show_id)) with check (public.can_manage_show(show_id));

create policy "members read submissions" on public.partner_month_submissions for select using (public.is_org_member(organization_id));
create policy "partner manages own submission" on public.partner_month_submissions for all
using (public.is_org_owner(organization_id) or partner_user_id = auth.uid())
with check (public.is_org_owner(organization_id) or partner_user_id = auth.uid());

create policy "owner reads month closure" on public.monthly_closures for select using (public.is_org_owner(organization_id));
create policy "owner manages month closure" on public.monthly_closures for all using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('show-expense-receipts', 'show-expense-receipts', false, 20971520)
on conflict (id) do nothing;

create policy "members read show expense receipts" on storage.objects for select to authenticated
using (
  bucket_id = 'show-expense-receipts'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "show managers upload receipts" on storage.objects for insert to authenticated
with check (
  bucket_id = 'show-expense-receipts'
  and public.can_manage_show((storage.foldername(name))[2]::uuid)
);

create policy "owner deletes receipts" on storage.objects for delete to authenticated
using (
  bucket_id = 'show-expense-receipts'
  and public.is_org_owner((storage.foldername(name))[1]::uuid)
);

create or replace function public.create_schedule_share_link_v1(p_show_id uuid, p_include_past_days integer default 7)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_show public.shows;
  v_token text;
begin
  select * into v_show from public.shows where id = p_show_id;
  if v_show.id is null or not public.can_manage_show(p_show_id) then
    raise exception 'not authorized';
  end if;

  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');

  insert into public.schedule_share_links (
    organization_id, show_id, token_hash, include_past_days, created_by
  ) values (
    v_show.organization_id,
    p_show_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    greatest(0, least(p_include_past_days, 90)),
    auth.uid()
  );

  return v_token;
end;
$$;

create or replace function public.get_public_schedule_v1(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_link public.schedule_share_links;
  v_timezone text;
begin
  select l.* into v_link
  from public.schedule_share_links l
  where l.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and l.is_active
    and (l.expires_at is null or l.expires_at > now());

  if v_link.id is null then return null; end if;
  select timezone into v_timezone from public.organizations where id = v_link.organization_id;

  return jsonb_build_object(
    'show', (select jsonb_build_object('id', s.id, 'name', s.name) from public.shows s where s.id = v_link.show_id),
    'performances', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'startsAt', p.starts_at,
        'endsAt', p.ends_at,
        'status', p.status,
        'hotel', h.name,
        'address', h.address,
        'notes', p.operational_notes
      ) order by p.starts_at)
      from public.performances p
      join public.hotels h on h.id = p.hotel_id
      where p.show_id = v_link.show_id
        and p.starts_at >= ((now() at time zone v_timezone)::date - v_link.include_past_days) at time zone v_timezone
        and p.status not in ('rescheduled')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.calculate_month_v1(p_organization_id uuid, p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next_month date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_timezone text;
  v_result jsonb;
begin
  if not public.is_org_owner(p_organization_id) then raise exception 'owner access required'; end if;
  select timezone into v_timezone from public.organizations where id = p_organization_id;

  with completed as (
    select p.*, (p.starts_at at time zone v_timezone)::date as work_date
    from public.performances p
    where p.organization_id = p_organization_id
      and p.status = 'completed'
      and (p.starts_at at time zone v_timezone)::date >= v_month
      and (p.starts_at at time zone v_timezone)::date < v_next_month
  ), revenue_lines as (
    select c.hotel_id, c.show_id, c.id as performance_id, c.work_date,
      greatest(coalesce(r.price_per_performance, 0) - c.billing_discount, 0) as amount
    from completed c
    left join lateral (
      select hsr.price_per_performance
      from public.hotel_show_rates hsr
      where hsr.hotel_id = c.hotel_id and hsr.show_id = c.show_id
        and hsr.valid_from <= c.work_date and (hsr.valid_to is null or hsr.valid_to >= c.work_date)
      order by hsr.valid_from desc limit 1
    ) r on true
  ), contract_work as (
    select ac.id as contract_id, ac.artist_id, ac.show_id, ac.monthly_salary, ac.extra_day_rate,
      public.required_work_days(v_month, ac.required_days_override) as required_days,
      count(distinct c.work_date) filter (where sa.id is not null)::integer as worked_days
    from public.artist_contracts ac
    left join completed c on c.show_id = ac.show_id
      and c.work_date >= ac.valid_from and (ac.valid_to is null or c.work_date <= ac.valid_to)
    left join public.show_artists sa on sa.show_id = ac.show_id and sa.artist_id = ac.artist_id
      and c.work_date >= sa.valid_from and (sa.valid_to is null or c.work_date <= sa.valid_to)
    where ac.organization_id = p_organization_id
      and ac.valid_from < v_next_month and (ac.valid_to is null or ac.valid_to >= v_month)
    group by ac.id
  ), adjustment_totals as (
    select aa.artist_id, aa.show_id,
      coalesce(sum(aa.amount) filter (where aa.type = 'deduction'), 0) as deductions,
      coalesce(sum(aa.amount) filter (where aa.type in ('reimbursement', 'bonus')), 0) as additions
    from public.artist_adjustments aa
    where aa.organization_id = p_organization_id and aa.month = v_month
    group by aa.artist_id, aa.show_id
  ), artist_reimbursements as (
    select e.paid_by_artist_id as artist_id, e.show_id, coalesce(sum(e.amount), 0) as amount
    from public.expenses e
    where e.organization_id = p_organization_id
      and e.status = 'approved'
      and e.paid_by = 'artist'
      and e.expense_date >= v_month and e.expense_date < v_next_month
    group by e.paid_by_artist_id, e.show_id
  ), payroll as (
    select cw.*, greatest(cw.worked_days - cw.required_days, 0) as extra_days,
      coalesce(ar.amount, 0) as reimbursements,
      cw.monthly_salary
        + greatest(cw.worked_days - cw.required_days, 0) * cw.extra_day_rate
        - coalesce(a.deductions, 0) + coalesce(a.additions, 0)
        + coalesce(ar.amount, 0) as payout
    from contract_work cw
    left join adjustment_totals a on a.artist_id = cw.artist_id and a.show_id = cw.show_id
    left join artist_reimbursements ar on ar.artist_id = cw.artist_id and ar.show_id = cw.show_id
  ), commission_work as (
    select cr.id as rule_id, cr.partner_user_id, cr.show_id, cr.base_monthly_commission, cr.extra_day_rate,
      public.required_work_days(v_month, cr.required_days_override) as required_days,
      count(distinct c.work_date)::integer as worked_days
    from public.partner_commission_rules cr
    left join completed c on c.show_id = cr.show_id
      and c.work_date >= cr.valid_from and (cr.valid_to is null or c.work_date <= cr.valid_to)
    where cr.organization_id = p_organization_id
      and cr.valid_from < v_next_month and (cr.valid_to is null or cr.valid_to >= v_month)
    group by cr.id
  ), commissions as (
    select *, greatest(worked_days - required_days, 0) as extra_days,
      base_monthly_commission + greatest(worked_days - required_days, 0) * extra_day_rate as total
    from commission_work
  ), partner_reimbursements as (
    select s.partner_user_id, e.show_id, coalesce(sum(e.amount), 0) as amount
    from public.expenses e
    join public.shows s on s.id = e.show_id
    where e.organization_id = p_organization_id
      and e.status = 'approved'
      and e.paid_by = 'partner'
      and e.expense_date >= v_month and e.expense_date < v_next_month
    group by s.partner_user_id, e.show_id
  ), commission_payouts as (
    select c.*, coalesce(pr.amount, 0) as reimbursements,
      c.total + coalesce(pr.amount, 0) as payout
    from commissions c
    left join partner_reimbursements pr
      on pr.partner_user_id = c.partner_user_id and pr.show_id = c.show_id
  ), expense_totals as (
    select
      coalesce(sum(amount) filter (where status = 'approved'), 0) as approved,
      coalesce(sum(amount) filter (where status = 'submitted'), 0) as awaiting_approval
    from public.expenses
    where organization_id = p_organization_id and expense_date >= v_month and expense_date < v_next_month
  )
  select jsonb_build_object(
    'month', v_month,
    'revenue', coalesce((select sum(amount) from revenue_lines), 0),
    'payroll', coalesce((select sum(payout - reimbursements) from payroll), 0),
    'commissions', coalesce((select sum(total) from commission_payouts), 0),
    'approvedExpenses', (select approved from expense_totals),
    'awaitingExpenseApproval', (select awaiting_approval from expense_totals),
    'profit', coalesce((select sum(amount) from revenue_lines), 0)
      - coalesce((select sum(payout - reimbursements) from payroll), 0)
      - coalesce((select sum(total) from commission_payouts), 0)
      - (select approved from expense_totals),
    'revenueLines', coalesce((select jsonb_agg(to_jsonb(r)) from revenue_lines r), '[]'::jsonb),
    'payrollLines', coalesce((select jsonb_agg(to_jsonb(p)) from payroll p), '[]'::jsonb),
    'commissionLines', coalesce((select jsonb_agg(to_jsonb(c)) from commission_payouts c), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.close_month_v1(p_organization_id uuid, p_month date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_snapshot jsonb;
begin
  if not public.is_org_owner(p_organization_id) then raise exception 'owner access required'; end if;
  if exists (
    select 1 from public.expenses
    where organization_id = p_organization_id
      and expense_date >= v_month and expense_date < (v_month + interval '1 month')::date
      and status in ('draft', 'submitted')
  ) then raise exception 'all expenses must be approved or rejected before closing'; end if;

  v_snapshot := public.calculate_month_v1(p_organization_id, v_month);
  insert into public.monthly_closures (organization_id, month, status, financial_snapshot, closed_by, closed_at)
  values (p_organization_id, v_month, 'closed', v_snapshot, auth.uid(), now())
  on conflict (organization_id, month) do update set
    status = 'closed', financial_snapshot = excluded.financial_snapshot,
    closed_by = excluded.closed_by, closed_at = excluded.closed_at;
  return v_snapshot;
end;
$$;

create or replace function public.submit_partner_month_v1(p_organization_id uuid, p_month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = auth.uid()
      and m.role = 'partner' and m.status = 'active'
  ) then raise exception 'partner access required'; end if;
  if not public.is_month_open(p_organization_id, v_month) then raise exception 'month is closed'; end if;

  insert into public.partner_month_submissions (organization_id, partner_user_id, month, submitted_at)
  values (p_organization_id, auth.uid(), v_month, now())
  on conflict (organization_id, partner_user_id, month)
  do update set submitted_at = excluded.submitted_at, reopened_at = null;
end;
$$;

create or replace function public.review_expense_v1(p_expense_id uuid, p_status public.expense_status, p_reason text default null)
returns public.expenses language plpgsql security definer set search_path = public as $$
declare
  v_expense public.expenses;
begin
  if p_status not in ('approved', 'rejected') then raise exception 'review status must be approved or rejected'; end if;
  select * into v_expense from public.expenses where id = p_expense_id;
  if v_expense.id is null or not public.is_org_owner(v_expense.organization_id) then raise exception 'owner access required'; end if;
  if not public.is_month_open(v_expense.organization_id, v_expense.expense_date) then raise exception 'month is closed'; end if;
  if p_status = 'rejected' and nullif(trim(p_reason), '') is null then raise exception 'rejection reason is required'; end if;

  update public.expenses set
    status = p_status,
    rejection_reason = case when p_status = 'rejected' then trim(p_reason) else null end,
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_expense_id returning * into v_expense;
  return v_expense;
end;
$$;

revoke all on function public.get_public_schedule_v1(text) from public;
grant execute on function public.get_public_schedule_v1(text) to anon, authenticated;
grant execute on function public.create_organization_v1(text, text) to authenticated;
grant execute on function public.create_schedule_share_link_v1(uuid, integer) to authenticated;
grant execute on function public.calculate_month_v1(uuid, date) to authenticated;
grant execute on function public.close_month_v1(uuid, date) to authenticated;
grant execute on function public.submit_partner_month_v1(uuid, date) to authenticated;
grant execute on function public.review_expense_v1(uuid, public.expense_status, text) to authenticated;
