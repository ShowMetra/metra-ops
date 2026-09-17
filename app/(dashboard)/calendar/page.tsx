import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export default async function CalendarPage() {
  const workspace = await requireWorkspace();
  const supabase = await createSupabaseServerClient();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 14);
  const to = new Date();
  to.setUTCMonth(to.getUTCMonth() + 4);
  const { data: performances } = await supabase.from("performances")
    .select("id, starts_at, ends_at, status, operational_notes, shows(name), hotels(name, address)")
    .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at");

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Live schedule</p><h1>Performance calendar</h1><p className="lede">Upcoming and recently completed performances visible to your role.</p></div></div>
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
