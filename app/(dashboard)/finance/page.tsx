import { AppShell } from "@/components/app-shell";

const hotels = [
  ["Stella Palace", "19", "€8,920", "Ready"],
  ["Lyttos Beach", "14", "€7,280", "Review"],
  ["Eliros Mare", "11", "€4,620", "Ready"],
  ["Pilot Beach", "9", "€3,780", "Ready"],
];

export default function FinancePage() {
  return <AppShell section="Monthly finance">
    <div className="pageHeader"><div><p className="eyebrow">September 2026</p><h1>Monthly finance</h1><p className="lede">Review hotel invoices, payroll, partner commissions and show expenses before closing.</p></div><button className="button primary">Close month</button></div>
    <div className="grid4">
      <div className="card metric"><div className="metricLabel">Revenue</div><div className="metricValue">€62,480</div><div className="metricMeta">Hotel invoice lines</div></div>
      <div className="card metric"><div className="metricLabel">Artist payroll</div><div className="metricValue">€31,920</div><div className="metricMeta">Base + €840 extra</div></div>
      <div className="card metric"><div className="metricLabel">Commissions & expenses</div><div className="metricValue">€9,740</div><div className="metricMeta">€1,420 awaits approval</div></div>
      <div className="card metric"><div className="metricLabel">Net profit</div><div className="metricValue">€20,820</div><div className="metricMeta positive">33.3% margin</div></div>
    </div>
    <section className="card section"><div className="sectionHeader"><h2>Hotel billing</h2><button className="button small">Export Excel</button></div><div className="sectionBody tableWrap"><table><thead><tr><th>Hotel</th><th className="num">Performances</th><th className="num">Invoice amount</th><th>Status</th></tr></thead><tbody>{hotels.map(h => <tr key={h[0]}><td className="strong">{h[0]}</td><td className="num">{h[1]}</td><td className="num strong">{h[2]}</td><td><span className={`badge ${h[3] === "Ready" ? "success" : "warning"}`}>{h[3]}</span></td></tr>)}</tbody></table></div></section>
  </AppShell>;
}
