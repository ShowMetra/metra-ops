alter table public.organizations
  add column billing_name text,
  add column billing_address text,
  add column billing_tax_id text,
  add column billing_iban text,
  add column billing_bank_name text,
  add column invoice_payment_terms_days integer not null default 14
    check (invoice_payment_terms_days between 0 and 90),
  add column invoice_tax_rate numeric(5,2) not null default 0
    check (invoice_tax_rate between 0 and 100),
  add column invoice_notes text;

grant update (
  billing_name,
  billing_address,
  billing_tax_id,
  billing_iban,
  billing_bank_name,
  invoice_payment_terms_days,
  invoice_tax_rate,
  invoice_notes
) on public.organizations to authenticated;

create type public.invoice_status as enum ('draft', 'sent', 'paid', 'void');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  invoice_number text not null,
  billing_month date not null check (billing_month = date_trunc('month', billing_month)::date),
  issue_date date not null,
  due_date date not null check (due_date >= issue_date),
  currency text not null check (char_length(currency) = 3),
  status public.invoice_status not null default 'draft',
  issuer_name text not null,
  issuer_address text,
  issuer_tax_id text,
  issuer_iban text,
  issuer_bank_name text,
  customer_name text not null,
  customer_address text,
  customer_tax_id text,
  customer_email text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_rate numeric(5,2) not null check (tax_rate between 0 and 100),
  tax_amount numeric(12,2) not null check (tax_amount >= 0),
  total numeric(12,2) not null check (total >= 0),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (organization_id, hotel_id, billing_month),
  unique (organization_id, invoice_number)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  performance_id uuid not null references public.performances(id) on delete restrict,
  service_date date not null,
  show_name text not null,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  sort_order integer not null check (sort_order > 0),
  unique (performance_id),
  unique (invoice_id, sort_order)
);

create table private.invoice_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_year integer not null check (invoice_year between 2000 and 9999),
  last_number integer not null check (last_number > 0),
  primary key (organization_id, invoice_year)
);

create index invoices_organization_month_idx
  on public.invoices (organization_id, billing_month desc);
create index invoices_hotel_id_idx on public.invoices (hotel_id);
create index invoices_created_by_idx on public.invoices (created_by);
create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

revoke all on table public.invoices, public.invoice_items from anon, authenticated;
grant select on table public.invoices, public.invoice_items to authenticated;
grant update (status, sent_at, updated_at) on public.invoices to authenticated;

create policy "owners read invoices"
on public.invoices for select to authenticated
using ((select public.is_org_owner(organization_id)));

create policy "owners update invoice status"
on public.invoices for update to authenticated
using ((select public.is_org_owner(organization_id)))
with check ((select public.is_org_owner(organization_id)));

create policy "owners read invoice items"
on public.invoice_items for select to authenticated
using (
  exists (
    select 1
    from public.invoices invoice
    where invoice.id = invoice_items.invoice_id
      and (select public.is_org_owner(invoice.organization_id))
  )
);

create or replace function public.create_hotel_invoice_v1(
  p_organization_id uuid,
  p_hotel_id uuid,
  p_billing_month date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_month date := date_trunc('month', p_billing_month)::date;
  v_next_month date := (date_trunc('month', p_billing_month) + interval '1 month')::date;
  v_timezone text;
  v_currency text;
  v_issuer_name text;
  v_issuer_address text;
  v_issuer_tax_id text;
  v_issuer_iban text;
  v_issuer_bank_name text;
  v_payment_terms integer;
  v_tax_rate numeric(5,2);
  v_notes text;
  v_customer_name text;
  v_customer_address text;
  v_customer_tax_id text;
  v_customer_email text;
  v_performance_count integer;
  v_missing_rate_count integer;
  v_subtotal numeric(12,2);
  v_tax_amount numeric(12,2);
  v_invoice_sequence integer;
  v_invoice_number text;
  v_invoice_id uuid;
  v_issue_date date := current_date;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not public.is_org_owner(p_organization_id) then raise exception 'owner access required'; end if;

  select organization.timezone,
    organization.base_currency,
    nullif(trim(organization.billing_name), ''),
    nullif(trim(organization.billing_address), ''),
    nullif(trim(organization.billing_tax_id), ''),
    nullif(trim(organization.billing_iban), ''),
    nullif(trim(organization.billing_bank_name), ''),
    organization.invoice_payment_terms_days,
    organization.invoice_tax_rate,
    nullif(trim(organization.invoice_notes), '')
  into v_timezone, v_currency, v_issuer_name, v_issuer_address, v_issuer_tax_id,
    v_issuer_iban, v_issuer_bank_name, v_payment_terms, v_tax_rate, v_notes
  from public.organizations organization
  where organization.id = p_organization_id;

  if v_issuer_name is null then raise exception 'company billing details are incomplete'; end if;

  select coalesce(nullif(trim(hotel.billing_name), ''), hotel.name),
    nullif(trim(hotel.address), ''),
    nullif(trim(hotel.tax_id), ''),
    nullif(trim(hotel.billing_email), '')
  into v_customer_name, v_customer_address, v_customer_tax_id, v_customer_email
  from public.hotels hotel
  where hotel.id = p_hotel_id
    and hotel.organization_id = p_organization_id;

  if v_customer_name is null then raise exception 'hotel not found'; end if;

  with finished as (
    select performance.id,
      performance.show_id,
      performance.billing_discount,
      (performance.starts_at at time zone v_timezone)::date as service_date
    from public.performances performance
    where performance.organization_id = p_organization_id
      and performance.hotel_id = p_hotel_id
      and performance.status in ('planned', 'completed')
      and coalesce(performance.ends_at, performance.starts_at) <= now()
      and (performance.starts_at at time zone v_timezone)::date >= v_month
      and (performance.starts_at at time zone v_timezone)::date < v_next_month
  ), rated as (
    select finished.*,
      rate.price_per_performance,
      rate.price_per_performance is null as rate_missing
    from finished
    left join lateral (
      select hotel_rate.price_per_performance
      from public.hotel_show_rates hotel_rate
      where hotel_rate.hotel_id = p_hotel_id
        and hotel_rate.show_id = finished.show_id
        and hotel_rate.valid_from <= finished.service_date
        and (hotel_rate.valid_to is null or hotel_rate.valid_to >= finished.service_date)
      order by hotel_rate.valid_from desc
      limit 1
    ) rate on true
  )
  select count(*)::integer,
    count(*) filter (where rate_missing)::integer,
    coalesce(sum(greatest(coalesce(price_per_performance, 0) - billing_discount, 0)), 0)
  into v_performance_count, v_missing_rate_count, v_subtotal
  from rated;

  if v_performance_count = 0 then raise exception 'no finished performances for this hotel and month'; end if;
  if v_missing_rate_count > 0 then raise exception 'finished performances without hotel rates cannot be invoiced'; end if;

  v_tax_amount := round(v_subtotal * v_tax_rate / 100, 2);

  insert into private.invoice_counters (organization_id, invoice_year, last_number)
  values (p_organization_id, extract(year from v_issue_date)::integer, 1)
  on conflict (organization_id, invoice_year)
  do update set last_number = invoice_counters.last_number + 1
  returning last_number into v_invoice_sequence;

  v_invoice_number := format(
    'INV-%s-%s',
    extract(year from v_issue_date)::integer,
    lpad(v_invoice_sequence::text, 5, '0')
  );

  insert into public.invoices (
    organization_id, hotel_id, invoice_number, billing_month, issue_date, due_date,
    currency, issuer_name, issuer_address, issuer_tax_id, issuer_iban, issuer_bank_name,
    customer_name, customer_address, customer_tax_id, customer_email,
    subtotal, tax_rate, tax_amount, total, notes, created_by
  ) values (
    p_organization_id, p_hotel_id, v_invoice_number, v_month, v_issue_date,
    v_issue_date + v_payment_terms, v_currency, v_issuer_name, v_issuer_address,
    v_issuer_tax_id, v_issuer_iban, v_issuer_bank_name, v_customer_name,
    v_customer_address, v_customer_tax_id, v_customer_email,
    v_subtotal, v_tax_rate, v_tax_amount, v_subtotal + v_tax_amount, v_notes, v_user_id
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, performance_id, service_date, show_name, description,
    unit_price, discount, line_total, sort_order
  )
  select v_invoice_id,
    performance.id,
    (performance.starts_at at time zone v_timezone)::date,
    show_row.name,
    show_row.name || ' performance',
    rate.price_per_performance,
    performance.billing_discount,
    greatest(rate.price_per_performance - performance.billing_discount, 0),
    row_number() over (order by performance.starts_at, performance.id)::integer
  from public.performances performance
  join public.shows show_row on show_row.id = performance.show_id
  join lateral (
    select hotel_rate.price_per_performance
    from public.hotel_show_rates hotel_rate
    where hotel_rate.hotel_id = p_hotel_id
      and hotel_rate.show_id = performance.show_id
      and hotel_rate.valid_from <= (performance.starts_at at time zone v_timezone)::date
      and (hotel_rate.valid_to is null
        or hotel_rate.valid_to >= (performance.starts_at at time zone v_timezone)::date)
    order by hotel_rate.valid_from desc
    limit 1
  ) rate on true
  where performance.organization_id = p_organization_id
    and performance.hotel_id = p_hotel_id
    and performance.status in ('planned', 'completed')
    and coalesce(performance.ends_at, performance.starts_at) <= now()
    and (performance.starts_at at time zone v_timezone)::date >= v_month
    and (performance.starts_at at time zone v_timezone)::date < v_next_month;

  return v_invoice_id;
exception
  when unique_violation then
    raise exception 'an invoice already exists for this hotel and month';
end;
$$;

revoke all on function public.create_hotel_invoice_v1(uuid, uuid, date)
from public, anon;
grant execute on function public.create_hotel_invoice_v1(uuid, uuid, date)
to authenticated;
