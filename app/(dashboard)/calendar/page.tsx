import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createPerformance } from "./actions";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 14);
  const to = new Date();
  to.setUTCMonth(to.getUTCMonth() + 4);
  const [{ data: performances }, { data: shows }, { data: hotels }] = await Promise.all([
    supabase.from("performances")
      .select("id, starts_at, ends_at, status, operational_notes, shows(name), hotels(name, address)")
      .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at"),
    supabase.from("shows").select("id, name").eq("status", "active").order("name"),
    supabase.from("hotels").select("id, name").eq("status", "active").order("name"),
  ]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: workspace.organization.timezone });

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Live schedule</p><h1>Performance calendar</h1><p className="lede">Upcoming and recently completed performances visible to your role.</p></div></div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    {workspace.membership.role === "partner" && <section className="card" style={{ marginBottom: 22 }}><div className="sectionHeader"><h2>Create performance</h2><span className="badge brand">{workspace.organization.timezone}</span></div><div className="sectionBody">
      {shows?.length && hotels?.length ? <form action={createPerformance} className="formGrid">
        <div className="field"><label htmlFor="performance_show">Show</label><select id="performance_show" name="show_id" required>{shows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
        <div className="field"><label htmlFor="performance_hotel">Hotel</label><select id="performance_hotel" name="hotel_id" required>{hotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></div>
        <div className="field"><label htmlFor="performance_date">Date</label><input id="performance_date" name="date" type="date" defaultValue={today} required /></div>
        <div className="field"><label htmlFor="performance_time">Start time</label><input id="performance_time" name="time" type="time" defaultValue="20:00" required /></div>
        <div className="field"><label htmlFor="performance_duration">Duration (minutes)</label><input id="performance_duration" name="duration_minutes" type="number" min="15" max="480" step="5" defaultValue="60" required /></div>
        <div className="field full"><label htmlFor="performance_notes">Operational notes</label><textarea id="performance_notes" name="notes" rows={3} /></div>
        <div className="field full"><SubmitButton className="button primary" type="submit" pendingLabel="Creating performance…">Create performance</SubmitButton></div>
      </form> : <div className="emptyState">Create a show and ask the owner to add a hotel first.</div>}
    </div></section>}
    <section className="card"><div className="sectionBody tableWrap" style={{ paddingTop: 8 }}><table><thead><tr><th>Date & time</th><th>Show</th><th>Hotel</th><th>Status</th><th>Notes</th></tr></thead><tbody>
      {(performances ?? []).map(item => {
        const show = Array.isArray(item.shows) ? item.shows[0] : item.shows;
        const hotel = Array.isArray(item.hotels) ? item.hotels[0] : item.hotels;
        return <tr key={item.id}><td className="strong">{new Date(item.starts_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.organization.timezone })}</td><td>{show?.name ?? "—"}</td><td><div>{hotel?.name ?? "—"}</div><div className="sub">{hotel?.address}</div></td><td><span className={`badge ${item.status === "completed" ? "success" : item.status === "planned" ? "brand" : "warning"}`}>{item.status.replaceAll("_", " ")}</span></td><td className="muted">{item.operational_notes || "—"}</td></tr>;
      })}
      {!performances?.length && <tr><td colSpan={5}><div className="emptyState">No performances yet. The next step is creating the first show, hotel and performance.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
