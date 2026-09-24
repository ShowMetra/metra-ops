-- Monthly finance is owner-only inside the function and must not be exposed to anonymous users.
revoke all on function public.calculate_month_v1(uuid, date) from public, anon;
grant execute on function public.calculate_month_v1(uuid, date) to authenticated;
