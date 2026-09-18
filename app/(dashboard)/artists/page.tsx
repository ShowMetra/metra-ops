import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createArtist } from "./actions";

export default async function ArtistsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const [{ data: artists }, { data: shows }] = await Promise.all([
    supabase.from("artists").select("id, full_name, artist_code, status, artist_contracts(monthly_salary, extra_day_rate, currency, valid_from, valid_to), show_artists(shows(name))").order("full_name"),
    supabase.from("shows").select("id, name").eq("status", "active").order("name"),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Artist payroll</p><h1>Artists</h1><p className="lede">Monthly salary stays fixed. Extra is added only above the required working days.</p></div></div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    {workspace.membership.role === "partner" && <section className="card" style={{ marginBottom: 22 }}><div className="sectionHeader"><h2>Add artist</h2><span className="badge brand">Includes first contract</span></div><div className="sectionBody">
      {shows?.length ? <form action={createArtist} className="formGrid">
        <div className="field"><label htmlFor="artist_name">Full name</label><input id="artist_name" name="full_name" required /></div>
        <div className="field"><label htmlFor="artist_code">Artist code</label><input id="artist_code" name="artist_code" placeholder="Optional" /></div>
        <div className="field full"><label htmlFor="artist_show">Show</label><select id="artist_show" name="show_id" required>{shows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
        <div className="field"><label htmlFor="artist_salary">Monthly salary ({workspace.organization.baseCurrency})</label><input id="artist_salary" name="monthly_salary" type="number" min="0" step="0.01" defaultValue="0" required /></div>
        <div className="field"><label htmlFor="artist_extra">Extra day rate ({workspace.organization.baseCurrency})</label><input id="artist_extra" name="extra_day_rate" type="number" min="0" step="0.01" defaultValue="0" required /></div>
        <div className="field"><label htmlFor="artist_valid_from">Contract valid from</label><input id="artist_valid_from" name="valid_from" type="date" defaultValue={today} required /></div>
        <div className="field buttonRow"><SubmitButton className="button primary" type="submit" pendingLabel="Creating artist…">Create artist</SubmitButton></div>
      </form> : <div className="emptyState">Create a show first, then add its artists.</div>}
    </div></section>}
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
