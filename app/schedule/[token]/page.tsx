import { getPublicSchedule } from "@/lib/public-schedule";

export default async function PublicSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const live = await getPublicSchedule(token);
  if (!live) return <div className="publicShell authShell"><main className="card authCard"><div className="brand"><span className="brandMark">S</span>ShowMetra</div><p className="eyebrow">Artist schedule</p><h1>Link unavailable</h1><p className="lede">This schedule link is invalid, expired or has been disabled. Ask the partner for a new link.</p></main></div>;
  const showName = live.show.name;
  const schedule = live.performances.map(item => {
    const date = new Date(item.startsAt);
    return {
      date: date.toLocaleDateString("en-GB", { month: "short", day: "2-digit" }),
      day: date.toLocaleDateString("en-GB", { weekday: "short" }),
      time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      show: showName,
      hotel: item.hotel,
      status: item.status.replaceAll("_", " "),
    };
  });
  return <div className="publicShell">
    <header className="publicHeader"><div className="publicHeaderInner"><div className="brand" style={{ margin: "0 0 34px" }}><span className="brandMark">S</span>ShowMetra</div><p className="eyebrow" style={{ color: "#c9c1ff" }}>Artist schedule</p><h1>{showName}</h1><p className="lede" style={{ color: "#cbc8d9" }}>Upcoming performances and schedule changes.</p></div></header>
    <main className="publicContent">
      <section className="card scheduleCard">{schedule.map(item => <div className="scheduleItem" key={`${item.date}-${item.show}-${item.time}`}><div className="dateBox"><strong>{item.date.split(" ")[1]}</strong><span>{item.day}</span></div><div><div className="strong">{item.hotel}</div><div className="sub">{item.time} · {item.show}</div></div><span className={`badge ${item.status.toLowerCase() === "completed" ? "success" : "brand"}`}>{item.status}</span></div>)}{!schedule.length && <div className="emptyState">No upcoming performances.</div>}</section>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16 }}><span className="muted" style={{ fontSize: 11 }}>Private schedule link · {token.slice(0, 8)}…</span><button className="button small">Add to calendar</button></div>
    </main>
  </div>;
}
