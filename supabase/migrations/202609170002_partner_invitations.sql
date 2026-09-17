alter table public.profiles add column if not exists email text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id and p.email is null;

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'partner' check (role = 'partner'),
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index organization_invitations_token_idx
on public.organization_invitations (token_hash);

alter table public.organization_invitations enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    lower(new.email)
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email),
    updated_at = now();
  return new;
end;
$$;

create policy "members read organization profiles"
on public.profiles for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members peer
      on peer.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and peer.user_id = profiles.id
      and peer.status = 'active'
  )
);

create policy "owner reads invitations"
on public.organization_invitations for select
using (public.is_org_owner(organization_id));

create policy "owner deletes invitations"
on public.organization_invitations for delete
using (public.is_org_owner(organization_id));

create or replace function public.create_partner_invitation_v1(
  p_organization_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_token text;
  v_invitation public.organization_invitations;
begin
  if not public.is_org_owner(p_organization_id) then
    raise exception 'owner access required';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'valid email is required';
  end if;
  if exists (
    select 1
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_organization_id
      and lower(p.email) = v_email
      and m.status = 'active'
  ) then
    raise exception 'this person is already a member';
  end if;

  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');

  insert into public.organization_invitations (
    organization_id, email, token_hash, expires_at, invited_by
  ) values (
    p_organization_id,
    v_email,
    encode(digest(v_token, 'sha256'), 'hex'),
    now() + interval '7 days',
    auth.uid()
  )
  on conflict (organization_id, email) do update set
    token_hash = excluded.token_hash,
    expires_at = excluded.expires_at,
    accepted_at = null,
    invited_by = excluded.invited_by,
    created_at = now()
  returning * into v_invitation;

  return jsonb_build_object(
    'id', v_invitation.id,
    'email', v_invitation.email,
    'token', v_token,
    'expiresAt', v_invitation.expires_at
  );
end;
$$;

create or replace function public.get_partner_invitation_v1(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.organization_invitations;
  v_organization public.organizations;
begin
  select * into v_invitation
  from public.organization_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if v_invitation.id is null then return null; end if;

  select * into v_organization
  from public.organizations
  where id = v_invitation.organization_id;

  return jsonb_build_object(
    'organizationName', v_organization.name,
    'email', v_invitation.email,
    'expiresAt', v_invitation.expires_at,
    'accepted', v_invitation.accepted_at is not null,
    'expired', v_invitation.expires_at <= now()
  );
end;
$$;

create or replace function public.accept_partner_invitation_v1(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.organization_invitations;
  v_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into v_invitation
  from public.organization_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;

  if v_invitation.id is null then raise exception 'invitation not found'; end if;
  if v_invitation.accepted_at is not null then raise exception 'invitation already accepted'; end if;
  if v_invitation.expires_at <= now() then raise exception 'invitation expired'; end if;
  if v_user_email <> v_invitation.email then
    raise exception 'sign in with the invited email address';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_invitation.organization_id, auth.uid(), 'partner', 'active')
  on conflict (organization_id, user_id) do update set status = 'active';

  update public.organization_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.organization_id;
end;
$$;

revoke all on function public.get_partner_invitation_v1(text) from public;
grant execute on function public.get_partner_invitation_v1(text) to anon, authenticated;
grant execute on function public.create_partner_invitation_v1(uuid, text) to authenticated;
grant execute on function public.accept_partner_invitation_v1(text) to authenticated;
