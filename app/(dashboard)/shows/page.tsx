import { AppShell } from "@/components/app-shell";
import { shows } from "@/lib/demo-data";

export default function ShowsPage() {
  return <AppShell section="Show management">
    <div className="pageHeader"><div><p className="eyebrow">Season 2026</p><h1>Shows</h1><p className="lede">Teams, hotel rates and shareable artist schedules.</p></div><button className="button primary">Create show</button></div>
    <div className="showGrid">{shows.map(show => <article className="card showCard" key={show.name}>
      <div className="showTop"><div><h2>{show.name}</h2><div className="sub">Partner · {show.partner}</div></div><span className="badge success">Active</span></div>
      <div className="showMeta"><div><span>Artists</span><strong>{show.artists}</strong></div><div><span>This month</span><strong>{show.performances} shows</strong></div><div><span>Default rate</span><strong>€{show.rate}</strong></div><div><span>Schedule</span><strong>Public link</strong></div></div>
      <div className="shareLink">showmetra.com/schedule/{show.token}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="button small">Copy link</button><button className="button small">Open show</button></div>
    </article>)}</div>
  </AppShell>;
}
