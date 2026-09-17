import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

type MonthCalculation = {
  revenue: number; payroll: number; commissions: number; approvedExpenses: number;
  awaitingExpenseApproval: number; profit: number;
};

const money = (value: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export default async function DashboardPage() {
  const workspace = await requireWorkspace();
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: workspace.organization.timezone });
  const start = now.toISOString();
  const end = new Date(now.getTime() + 45 * 86400000).toISOString();

  const [{ data: upcoming }, { count: showCount }, { count: artistCount }, { count: submittedExpenses }] = await Promise.all([
    supabase.from("performances").select("id, starts_at, status, shows(name), hotels(name)").gte("starts_at", start).lt("starts_at", end).order("starts_at").limit(6),
    supabase.from("shows").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("artists").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("status", "submitted"),
  ]);

  let calculation: MonthCalculation | null = null;
  if (workspace.membership.role === "owner") {
    const { data } = await supabase.rpc("calculate_month_v1", { p_organization_id: workspace.organization.id, p_month: month });
    calculation = data as MonthCalculation | null;
  }

  return <>
    <div className="pageHeader"><div><p className="eyebrow">{monthLabel}</p><h1>Operations overview</h1><p className="lede">Live schedule and financial data for {workspace.organization.name}.</p></div><Link className="button primary" href="/calendar">Open schedule</Link></div>
    <div className="grid4">
      {workspace.membership.role === "owner" ? <>
        <div className="card metric"><div className="metricLabel">Hotel revenue</div><div className="metricValue">{money(Number(calculation?.revenue ?? 0), workspace.organization.baseCurrency)}</div><div className="metricMeta">Completed performances</div></div>
        <div className="card metric"><div className="metricLabel">Payroll</div><div className="metricValue">{money(Number(calculation?.payroll ?? 0), workspace.organization.baseCurrency)}</div><div className="metricMeta">Base salary + extra</div></div>
        <div className="card metric"><div className="metricLabel">Commissions & expenses</div><div className="metricValue">{money(Number(calculation?.commissions ?? 0) + Number(calculation?.approvedExpenses ?? 0), workspace.organization.baseCurrency)}</div><div className="metricMeta">{submittedExpenses ?? 0} expenses need review</div></div>
        <div className="card metric"><div className="metricLabel">Projected profit</div><div className="metricValue">{money(Number(calculation?.profit ?? 0), workspace.organization.baseCurrency)}</div><div className="metricMeta positive">Live monthly calculation</div></div>
      </> : <>
        <div className="card metric"><div className="metricLabel">Assigned shows</div><div className="metricValue">{showCount ?? 0}</div><div className="metricMeta">Active shows</div></div>
        <div className="card metric"><div className="metricLabel">Artists</div><div className="metricValue">{artistCount ?? 0}</div><div className="metricMeta">In your casts</div></div>
        <div className="card metric"><div className="metricLabel">Expenses submitted</div><div className="metricValue">{submittedExpenses ?? 0}</div><div className="metricMeta">Waiting for owner review</div></div>
        <div className="card metric"><div className="metricLabel">Access</div><div className="metricValue">Partner</div><div className="metricMeta positive">Limited to assigned shows</div></div>
      </>}
    </div>
    <section className="card section">
      <div className="sectionHeader"><h2>Upcoming performances</h2><Link className="button small" href="/calendar">Open calendar</Link></div>
      <div className="sectionBody"><div className="list">
        {(upcoming ?? []).map(item => {
          const show = Array.isArray(item.shows) ? item.shows[0] : item.shows;
          const hotel = Array.isArray(item.hotels) ? item.hotels[0] : item.hotels;
          const date = new Date(item.starts_at);
          return <div className="listItem" key={item.id}><div><div className="strong">{show?.name ?? "Untitled show"}</div><div className="sub">{date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.organization.timezone })} · {hotel?.name ?? "No hotel"}</div></div><span className={`badge ${item.status === "completed" ? "success" : "brand"}`}>{item.status.replaceAll("_", " ")}</span></div>;
        })}
        {!upcoming?.length && <div className="emptyState">No upcoming performances yet.</div>}
      </div></div>
    </section>
  </>;
}
