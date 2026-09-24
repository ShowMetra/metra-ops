# Remarc Entertainment Operations

Internal scheduling and finance workspace for Remarc Entertainment.

## First vertical slice

1. A partner schedules a performance for one of their shows.
2. Artists see the updated schedule through a revocable public link.
3. The partner confirms whether the performance happened.
4. Confirmed performances feed hotel billing, artist working days and partner commissions.
5. Partners submit show expenses with receipts.
6. The owner reviews adjustments and closes the month.

## Confirmed compensation rules

- An artist receives their full monthly salary when working at or below the required days.
- Required days default to calendar days in the month minus two: 28 for a 30-day month and 29 for a 31-day month.
- Each distinct completed work date above the requirement earns a configurable extra-day rate.
- Partner commissions have a configurable monthly base and configurable extra-day rate per show.
- Partners manage their own shows, calendars, hotel rates, commissions and show expenses.
- The owner has full access and is the only role that can approve or close a month.
- Artists do not have accounts. Each show has a revocable public schedule link.

The February interpretation of the `days in month - 2` default remains configurable per contract until confirmed.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apply `supabase/migrations` to a new Supabase project, then place the project URL and anon key in `.env.local`.

## Access flow

1. The owner creates an account at `/register` and confirms their email.
2. The owner creates the organization workspace.
3. In **Team**, the owner creates a seven-day invitation link for a partner email.
4. The partner opens the link, registers with the invited email and joins the organization.
5. Supabase RLS restricts partners to shows, artists, performances and expenses assigned to them.

The application uses Supabase Auth cookies refreshed by the Next.js `proxy.ts` entry point. Never expose a Supabase service-role key to the browser.

## Project structure

- `app/` — Next.js pages
- `components/` — shared interface components
- `lib/` — application and Supabase helpers
- `supabase/migrations/` — database schema, policies and financial functions
- `supabase/tests/` — executable SQL checks for core compensation rules
