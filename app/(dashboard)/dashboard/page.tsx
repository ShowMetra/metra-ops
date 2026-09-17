import { AppShell } from "@/components/app-shell";
import { performances } from "@/lib/demo-data";

export default function DashboardPage() {
  return <AppShell section="Company overview">
    <div className="pageHeader"><div><p className="eyebrow">September 2026</p><h1>Operations overview</h1><p className="lede">Schedule, monthly figures and items waiting for your review.</p></div><button className="button primary">Add performance</button></div>
    <div className="grid4">
      <div className="card metric"><div className="metricLabel">Hotel revenue</div><div className="metricValue">€62,480</div><div className="metricMeta positive">84 completed performances</div></div>
      <div className="card metric"><div className="metricLabel">Payroll</div><div className="metricValue">€31,920</div><div className="metricMeta">66 artists</div></div>
      <div className="card metric"><div className="metricLabel">Commissions & expenses</div><div className="metricValue">€9,740</div><div className="metricMeta">5 items need approval</div></div>
      <div className="card metric"><div className="metricLabel">Projected profit</div><div className="metricValue">€20,820</div><div className="metricMeta positive">33.3% margin</div></div>
    </div>
    <div className="grid2 section">
      <section className="card">
        <div className="sectionHeader"><h2>Upcoming performances</h2><a className="button small" href="/calendar">Open calendar</a></div>
        <div className="sectionBody"><div className="list">{performances.map(item => <div className="listItem" key={`${item.date}-${item.show}`}><div><div className="strong">{item.show}</div><div className="sub">{item.date} · {item.time} · {item.hotel}</div></div><span className={`badge ${item.status === "Completed" ? "success" : "brand"}`}>{item.status}</span></div>)}</div></div>
      </section>
      <section className="card">
        <div className="sectionHeader"><h2>Month closing</h2><span className="badge warning">In progress</span></div>
        <div className="sectionBody">
          <div className="progress"><span style={{ width: "72%" }} /></div>
          <div className="list" style={{ marginTop: 14 }}>
            <div className="listItem"><div><div className="strong">Performances confirmed</div><div className="sub">84 of 89</div></div><span className="badge warning">5 open</span></div>
            <div className="listItem"><div><div className="strong">Partner submissions</div><div className="sub">4 of 5 received</div></div><span className="badge warning">1 open</span></div>
            <div className="listItem"><div><div className="strong">Expenses reviewed</div><div className="sub">42 of 45</div></div><span className="badge warning">3 open</span></div>
          </div>
        </div>
      </section>
    </div>
  </AppShell>;
}
