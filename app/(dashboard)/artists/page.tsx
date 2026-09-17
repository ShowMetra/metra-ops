import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export default async function ArtistsPage() {
  const workspace = await requireWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: artists } = await supabase.from("artists").select("id, full_name, artist_code, status, artist_contracts(monthly_salary, extra_day_rate, currency, valid_from, valid_to), show_artists(shows(name))").order("full_name");

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Artist payroll</p><h1>Artists</h1><p className="lede">Monthly salary stays fixed. Extra is added only above the required working days.</p></div></div>
    <div className="card sectionBody tableWrap" style={{ paddingTop: 8 }}><table><thead><tr><th>Artist</th><th>Show</th><th>Monthly salary</th><th>Extra day</th><th>Status</th></tr></thead><tbody>
      {(artists ?? []).map(artist => {
        const contract = artist.artist_contracts?.[0];
        const showNames = artist.show_artists?.map(item => {
          const show = Array.isArray(item.shows) ? item.shows[0] : item.shows;
          return show?.name;
        }).filter(Boolean).join(", ");
        const currency = contract?.currency ?? workspace.organization.baseCurrency;
        const format = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
        return <tr key={artist.id}><td><div className="strong">{artist.full_name}</div><div className="sub">{artist.artist_code || "No code"}</div></td><td>{showNames || "—"}</td><td>{format(contract?.monthly_salary)}</td><td>{format(contract?.extra_day_rate)}</td><td><span className={`badge ${artist.status === "active" ? "success" : "warning"}`}>{artist.status}</span></td></tr>;
      })}
      {!artists?.length && <tr><td colSpan={5}><div className="emptyState">No artists have been added yet.</div></td></tr>}
    </tbody></table></div>
  </>;
}
