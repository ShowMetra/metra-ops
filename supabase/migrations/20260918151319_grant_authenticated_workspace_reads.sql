-- Signed-in users need table privileges before row-level security can evaluate
-- the existing tenant-scoped policies.
grant select on table public.organization_members to authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.profiles to authenticated;
