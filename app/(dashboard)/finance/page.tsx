import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

type RevenueLine = { hotel_id: string; amount: number };
type MonthlyLine = {
  month: string;
  revenue: number;
  payroll: number;
  commissions: number;
  approvedExpenses: number;
  awaitingExpenseApproval: number;
  profit: number;
};
type PeriodCalculation = {
  revenue: number;
  payroll: number;
  commissions: number;
  approvedExpenses: number;
  awaitingExpenseApproval: number;
  profit: number;
  revenueLines: RevenueLine[];
  monthlyLines: MonthlyLine[];
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthDate = (value: string) => new Date(`${value}-01T00:00:00Z`);
const monthsBetween = (from: string, to: string) =>
  (monthDate(to).getUTCFullYear() - monthDate(from).getUTCFullYear()) * 12
  + monthDate(to).getUTCMonth() - monthDate(from).getUTCMonth();
const localMonth = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(value);
  const part = (type: "year" | "month") => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}`;
};

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ from?: string | string[]; to?: string | string[] }> }) {
  const [workspace, query] = await Promise.all([requireWorkspace(), searchParams]);
  const now = new Date();
  const currentMonth = localMonth(now, workspace.organization.timezone);
  const requestedFrom = typeof query.from === "string" ? query.from : currentMonth;
  const requestedTo = typeof query.to === "string" ? query.to : requestedFrom;
  const validRange = monthPattern.test(requestedFrom)
    && monthPattern.test(requestedTo)
    && monthsBetween(requestedFrom, requestedTo) >= 0
    && monthsBetween(requestedFrom, requestedTo) < 24;
  const from = validRange ? requestedFrom : currentMonth;
  const to = validRange ? requestedTo : currentMonth;

  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: hotels }] = await Promise.all([
    supabase.rpc("calculate_finance_period_v1", {
      p_organization_id: workspace.organization.id,
      p_start_month: `${from}-01`,
      p_end_month: `${to}-01`,
    }),
    supabase.from("hotels").select("id, name"),
  ]);
  const calculation = data as PeriodCalculation | null;
  const format = (value: number) => new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: workspace.organization.baseCurrency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
  const monthLabel = (value: string) => monthDate(value.slice(0, 7)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const periodLabel = from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`;
  const hotelTotals = new Map<string, { count: number; total: number }>();
  for (const line of calculation?.revenueLines ?? []) {
    const current = hotelTotals.get(line.hotel_id) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total += Number(line.amount);
    hotelTotals.set(line.hotel_id, current);
  }
  const isOwner = workspace.membership.role === "owner";

  return <>
    <div className="pageHeader"><div><p className="eyebrow">{isOwner ? "Company-wide finance" : "Your partner portfolio"} · {periodLabel}</p><h1>Finance</h1><p className="lede">{isOwner ? "Income and expenses across all partners." : "Income and expenses from only the shows assigned to you."} Only finished performances are included.</p></div><span className={`badge ${isOwner ? "brand" : "success"}`}>{isOwner ? "Owner · All partners" : "Partner · Your shows"}</span></div>
    {!validRange && <div className="notice danger">Choose a valid period of up to 24 months.</div>}
    {error && <div className="notice danger">Could not calculate finance for this period.</div>}

    <section className="card" style={{ marginBottom: 22 }}><div className="sectionHeader"><h2>Reporting period</h2><span className="badge brand">Up to 24 months</span></div><div className="sectionBody">
      <form method="get" className="formGrid">
        <div className="field"><label htmlFor="finance_from">From month</label><input id="finance_from" name="from" type="month" defaultValue={from} required /></div>
        <div className="field"><label htmlFor="finance_to">To month</label><input id="finance_to" name="to" type="month" defaultValue={to} required /></div>
        <div className="field full"><button className="button primary" type="submit">Show finance</button></div>
      </form>
    </div></section>

    <div className="grid4">
      <div className="card metric"><div className="metricLabel">Revenue</div><div className="metricValue">{format(calculation?.revenue ?? 0)}</div><div className="metricMeta">Finished performances only</div></div>
      <div className="card metric"><div className="metricLabel">Artist payroll</div><div className="metricValue">{format(calculation?.payroll ?? 0)}</div><div className="metricMeta">Base + extra days</div></div>
      <div className="card metric"><div className="metricLabel">Commissions & expenses</div><div className="metricValue">{format(Number(calculation?.commissions ?? 0) + Number(calculation?.approvedExpenses ?? 0))}</div><div className="metricMeta">{format(calculation?.awaitingExpenseApproval ?? 0)} awaits approval</div></div>
      <div className="card metric"><div className="metricLabel">Net profit</div><div className="metricValue">{format(calculation?.profit ?? 0)}</div><div className="metricMeta positive">{isOwner ? "All partner portfolios" : "Your assigned shows"}</div></div>
    </div>

    <section className="card section"><div className="sectionHeader"><h2>Monthly breakdown</h2></div><div className="sectionBody tableWrap"><table><thead><tr><th>Month</th><th className="num">Revenue</th><th className="num">Payroll</th><th className="num">Commissions & expenses</th><th className="num">Net profit</th></tr></thead><tbody>
      {(calculation?.monthlyLines ?? []).map(line => <tr key={line.month}><td className="strong">{monthLabel(line.month)}</td><td className="num">{format(line.revenue)}</td><td className="num">{format(line.payroll)}</td><td className="num">{format(Number(line.commissions) + Number(line.approvedExpenses))}</td><td className="num strong">{format(line.profit)}</td></tr>)}
      {!calculation?.monthlyLines?.length && <tr><td colSpan={5}><div className="emptyState">No financial activity in this period.</div></td></tr>}
    </tbody></table></div></section>

    <section className="card section"><div className="sectionHeader"><h2>Hotel billing</h2></div><div className="sectionBody tableWrap"><table><thead><tr><th>Hotel</th><th className="num">Finished performances</th><th className="num">Invoice amount</th></tr></thead><tbody>
      {Array.from(hotelTotals.entries()).map(([hotelId, total]) => <tr key={hotelId}><td className="strong">{hotels?.find(hotel => hotel.id === hotelId)?.name ?? "Hotel"}</td><td className="num">{total.count}</td><td className="num strong">{format(total.total)}</td></tr>)}
      {!hotelTotals.size && <tr><td colSpan={3}><div className="emptyState">No finished, rated performances in this period.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
