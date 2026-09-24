import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createPerformance, deletePerformance, updatePerformance } from "./actions";

const localParts = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const [{ data: performances }, { data: shows }, { data: hotels }, { data: profiles }] = await Promise.all([
    supabase.from("performances")
      .select("id, show_id, hotel_id, starts_at, ends_at, operational_notes, shows(name, partner_user_id), hotels(name, address)")
      .order("starts_at", { ascending: false }),
    supabase.from("shows").select("id, name").eq("status", "planned").order("name"),
    supabase.from("hotels").select("id, name").eq("status", "active").order("name"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const partnerNames = new Map((profiles ?? []).map(profile => [profile.id, profile.full_name || profile.email || "Partner"]));
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const defaultDate = localParts(tomorrow, workspace.organization.timezone).date;

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Live schedule</p><h1>Performance calendar</h1><p className="lede">Past performances are automatically Finished. Future performances stay Planned and editable.</p></div></div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    {workspace.membership.role === "partner" && <section className="card" style={{ marginBottom: 22 }}><div className="sectionHeader"><h2>Create performance</h2><span className="badge brand">{workspace.organization.timezone}</span></div><div className="sectionBody">
      {shows?.length && hotels?.length ? <form action={createPerformance} className="formGrid">
        <div className="field"><label htmlFor="performance_show">Show</label><select id="performance_show" name="show_id" required>{shows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
        <div className="field"><label htmlFor="performance_hotel">Hotel</label><select id="performance_hotel" name="hotel_id" required>{hotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></div>
        <div className="field"><label htmlFor="performance_date">Date</label><input id="performance_date" name="date" type="date" defaultValue={defaultDate} required /></div>
        <div className="field"><label htmlFor="performance_time">Start time</label><input id="performance_time" name="time" type="time" defaultValue="20:00" required /></div>
        <div className="field"><label htmlFor="performance_duration">Duration (minutes)</label><input id="performance_duration" name="duration_minutes" type="number" min="15" max="480" step="5" defaultValue="60" required /></div>
        <div className="field full"><label htmlFor="performance_notes">Operational notes</label><textarea id="performance_notes" name="notes" rows={3} /></div>
        <div className="field full"><SubmitButton className="button primary" type="submit" pendingLabel="Creating performance…">Create performance</SubmitButton></div>
      </form> : <div className="emptyState">Create a show and ask the owner to add a hotel first.</div>}
    </div></section>}
    <section className="card"><div className="sectionBody tableWrap" style={{ paddingTop: 8 }}><table><thead><tr><th>Date & time</th><th>Show</th><th>Hotel</th>{workspace.membership.role === "owner" && <th>Partner</th>}<th>Status</th><th>Notes</th>{workspace.membership.role === "partner" && <th>Actions</th>}</tr></thead><tbody>
      {(performances ?? []).map(item => {
        const show = Array.isArray(item.shows) ? item.shows[0] : item.shows;
        const hotel = Array.isArray(item.hotels) ? item.hotels[0] : item.hotels;
        const start = new Date(item.starts_at);
        const end = new Date(item.ends_at || item.starts_at);
        const isFinished = end.getTime() <= now.getTime();
        const values = localParts(start, workspace.organization.timezone);
        const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
        return <tr key={item.id}>
          <td className="strong">{start.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.organization.timezone })}</td>
          <td>{show?.name ?? "—"}</td>
          <td><div>{hotel?.name ?? "—"}</div><div className="sub">{hotel?.address}</div></td>
          {workspace.membership.role === "owner" && <td>{show?.partner_user_id ? partnerNames.get(show.partner_user_id) ?? "Unknown" : "—"}</td>}
          <td><span className={`badge ${isFinished ? "success" : "brand"}`}>{isFinished ? "Finished" : "Planned"}</span></td>
          <td className="muted">{item.operational_notes || "—"}</td>
          {workspace.membership.role === "partner" && <td>{isFinished ? <span className="muted">Locked</span> : <div className="showActions">
            <details className="showEditor"><summary>Edit</summary><form action={updatePerformance} className="formGrid compactForm">
              <input name="performance_id" type="hidden" value={item.id} />
              <div className="field"><label htmlFor={`show_${item.id}`}>Show</label><select id={`show_${item.id}`} name="show_id" defaultValue={item.show_id} required>{shows?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
              <div className="field"><label htmlFor={`hotel_${item.id}`}>Hotel</label><select id={`hotel_${item.id}`} name="hotel_id" defaultValue={item.hotel_id} required>{hotels?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
              <div className="field"><label htmlFor={`date_${item.id}`}>Date</label><input id={`date_${item.id}`} name="date" type="date" defaultValue={values.date} required /></div>
              <div className="field"><label htmlFor={`time_${item.id}`}>Start time</label><input id={`time_${item.id}`} name="time" type="time" defaultValue={values.time} required /></div>
              <div className="field"><label htmlFor={`duration_${item.id}`}>Duration (minutes)</label><input id={`duration_${item.id}`} name="duration_minutes" type="number" min="15" max="480" step="5" defaultValue={duration} required /></div>
              <div className="field full"><label htmlFor={`notes_${item.id}`}>Operational notes</label><textarea id={`notes_${item.id}`} name="notes" defaultValue={item.operational_notes || ""} rows={3} /></div>
              <div className="field full"><SubmitButton className="button primary small" type="submit" pendingLabel="Saving…">Save</SubmitButton></div>
            </form></details>
            <form action={deletePerformance}><input name="performance_id" type="hidden" value={item.id} /><ConfirmSubmitButton className="button danger small" type="submit" pendingLabel="Deleting…" confirmMessage="Delete this planned performance?">Delete</ConfirmSubmitButton></form>
          </div>}</td>}
        </tr>;
      })}
      {!performances?.length && <tr><td colSpan={6}><div className="emptyState">No performances yet. Create the first future calendar entry.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
