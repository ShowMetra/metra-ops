import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

type RevenueLine = { hotel_id: string; amount: number };
type MonthCalculation = { revenue: number; payroll: number; commissions: number; approvedExpenses: number; awaitingExpenseApproval: number; profit: number; revenueLines: RevenueLine[] };

export default async function FinancePage() {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "owner") return <><div className="pageHeader"><div><p className="eyebrow">Owner only</p><h1>Monthly finance</h1><p className="lede">Partners can manage their operational data, but only the owner sees company-wide finance and profit.</p></div></div><div className="card emptyCard"><div className="emptyState">Financial overview is restricted to the owner.</div></div></>;

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const [{ data }, { data: hotels }] = await Promise.all([
    supabase.rpc("calculate_month_v1", { p_organization_id: workspace.organization.id, p_month: month }),
    supabase.from("hotels").select("id, name"),
  ]);
  const calculation = data as MonthCalculation | null;
  const format = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: workspace.organization.baseCurrency, maximumFractionDigits: 0 }).format(Number(value || 0));
  const hotelTotals = new Map<string, { count: number; total: number }>();
  for (const line of calculation?.revenueLines ?? []) {
    const current = hotelTotals.get(line.hotel_id) ?? { count: 0, total: 0 };
    current.count += 1; current.total += Number(line.amount); hotelTotals.set(line.hotel_id, current);
  }

  return <>
    <div className="pageHeader"><div><p className="eyebrow">{now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p><h1>Monthly finance</h1><p className="lede">Revenue, payroll, commissions and approved expenses from finished shows.</p></div></div>
    <div className="grid4">
      <div className="card metric"><div className="metricLabel">Revenue</div><div className="metricValue">{format(calculation?.revenue ?? 0)}</div><div className="metricMeta">Finished shows only</div></div>
      <div className="card metric"><div className="metricLabel">Artist payroll</div><div className="metricValue">{format(calculation?.payroll ?? 0)}</div><div className="metricMeta">Base + extra</div></div>
      <div className="card metric"><div className="metricLabel">Commissions & expenses</div><div className="metricValue">{format(Number(calculation?.commissions ?? 0) + Number(calculation?.approvedExpenses ?? 0))}</div><div className="metricMeta">{format(calculation?.awaitingExpenseApproval ?? 0)} awaits approval</div></div>
      <div className="card metric"><div className="metricLabel">Net profit</div><div className="metricValue">{format(calculation?.profit ?? 0)}</div><div className="metricMeta positive">Calculated in Supabase</div></div>
    </div>
    <section className="card section"><div className="sectionHeader"><h2>Hotel billing</h2></div><div className="sectionBody tableWrap"><table><thead><tr><th>Hotel</th><th className="num">Finished performances</th><th className="num">Invoice amount</th></tr></thead><tbody>
      {Array.from(hotelTotals.entries()).map(([hotelId, total]) => <tr key={hotelId}><td className="strong">{hotels?.find(hotel => hotel.id === hotelId)?.name ?? "Hotel"}</td><td className="num">{total.count}</td><td className="num strong">{format(total.total)}</td></tr>)}
      {!hotelTotals.size && <tr><td colSpan={3}><div className="emptyState">No finished, rated shows in this month.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
