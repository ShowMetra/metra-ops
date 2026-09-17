begin;

do $$
begin
  assert public.required_work_days(date '2026-09-01') = 28,
    '30-day month must require 28 days';
  assert public.required_work_days(date '2026-08-01') = 29,
    '31-day month must require 29 days';
  assert public.required_work_days(date '2026-08-01', 25) = 25,
    'contract override must take precedence';
end;
$$;

rollback;
