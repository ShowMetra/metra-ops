grant update (valid_to) on table public.artist_contracts to authenticated;

drop policy if exists "partners close own artist contracts" on public.artist_contracts;
create policy "partners close own artist contracts"
on public.artist_contracts for update to authenticated
using (
  exists (
    select 1
    from public.shows show_row
    join public.artists artist on artist.id = artist_contracts.artist_id
    join public.organization_members member
      on member.organization_id = artist_contracts.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = artist_contracts.show_id
      and show_row.organization_id = artist_contracts.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and artist.organization_id = artist_contracts.organization_id
      and artist.partner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.shows show_row
    join public.artists artist on artist.id = artist_contracts.artist_id
    join public.organization_members member
      on member.organization_id = artist_contracts.organization_id
     and member.user_id = (select auth.uid())
     and member.role = 'partner'
     and member.status = 'active'
    where show_row.id = artist_contracts.show_id
      and show_row.organization_id = artist_contracts.organization_id
      and show_row.partner_user_id = (select auth.uid())
      and show_row.status = 'planned'
      and artist.organization_id = artist_contracts.organization_id
      and artist.partner_user_id = (select auth.uid())
  )
);

alter function public.create_artist_contract_v1(
  uuid, uuid, uuid, public.artist_payment_type, numeric, numeric, numeric, text, date, date
) security invoker;
