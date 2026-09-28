import { Fragment } from "react";
import { ContractFields } from "@/components/contract-fields";
import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createArtist, createArtistContract } from "./actions";

export default async function ArtistsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const [{ data: artists }, { data: shows }] = await Promise.all([
    supabase.from("artists").select("id, full_name, artist_code, status, artist_contracts(id, show_id, payment_type, monthly_salary, extra_day_rate, daily_rate, currency, valid_from, valid_to, shows(name)), show_artists(show_id, shows(name))").order("full_name"),
    supabase.from("shows").select("id, name").eq("status", "planned").order("name"),
  ]);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const isPartner = workspace.membership.role === "partner";
  const formatDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC" });

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Artist payroll</p><h1>Artists</h1><p className="lede">Create dated contracts with either a monthly salary or a daily rate. Finance automatically uses the contract active on each performance date.</p></div></div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    {isPartner && <section className="card" style={{ marginBottom: 22 }}><div className="sectionHeader"><h2>Add artist</h2><span className="badge brand">Includes first contract</span></div><div className="sectionBody">
      {shows?.length ? <form action={createArtist} className="formGrid">
        <div className="field"><label htmlFor="artist_name">Full name</label><input id="artist_name" name="full_name" required /></div>
        <div className="field"><label htmlFor="artist_code">Artist code</label><input id="artist_code" name="artist_code" placeholder="Optional" /></div>
        <div className="field full"><label htmlFor="artist_show">Show</label><select id="artist_show" name="show_id" required>{shows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
        <ContractFields idPrefix="artist_contract" currency={workspace.organization.baseCurrency} defaultFrom={today} />
        <div className="field full"><SubmitButton className="button primary" type="submit" pendingLabel="Creating artist…">Create artist</SubmitButton></div>
      </form> : <div className="emptyState">Create a show first, then add its artists.</div>}
    </div></section>}

    <section className="card"><div className="sectionHeader"><h2>Artists & contracts</h2><span className="badge">{artists?.length ?? 0}</span></div><div className="sectionBody tableWrap"><table><thead><tr><th>Artist</th><th>Show</th><th>Contract history</th><th>Status</th></tr></thead><tbody>
      {(artists ?? []).map(artist => {
        const assignedShows = (artist.show_artists ?? []).map(item => {
          const show = Array.isArray(item.shows) ? item.shows[0] : item.shows;
          return { id: item.show_id, name: show?.name ?? "Show" };
        });
        const contracts = [...(artist.artist_contracts ?? [])].sort((left, right) => right.valid_from.localeCompare(left.valid_from));
        return <Fragment key={artist.id}>
          <tr className={isPartner ? "artistRowWithEditor" : undefined}>
            <td><div className="strong">{artist.full_name}</div><div className="sub">{artist.artist_code || "No code"}</div></td>
            <td>{assignedShows.map(show => show.name).join(", ") || "—"}</td>
            <td>{contracts.length ? <div className="contractList">{contracts.map(contract => {
              const show = Array.isArray(contract.shows) ? contract.shows[0] : contract.shows;
              const format = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: contract.currency }).format(value);
              return <div key={contract.id}><strong>{contract.payment_type === "daily" ? `${format(contract.daily_rate)} / day` : `${format(contract.monthly_salary)} / month`}</strong><div className="sub">{show?.name ?? "Show"}{contract.payment_type === "monthly" && Number(contract.extra_day_rate) > 0 ? ` · ${format(contract.extra_day_rate)} extra day` : ""}</div><div className="sub">{formatDate(contract.valid_from)} – {contract.valid_to ? formatDate(contract.valid_to) : "open ended"}</div></div>;
            })}</div> : "—"}</td>
            <td><span className={`badge ${artist.status === "active" ? "success" : "warning"}`}>{artist.status}</span></td>
          </tr>
          {isPartner && <tr className="artistContractRow"><td colSpan={4}>{assignedShows.length ? <details className="artistContractEditor"><summary>Add contract</summary><form action={createArtistContract} className="formGrid compactForm">
              <input name="artist_id" type="hidden" value={artist.id} />
              <div className="field full"><label htmlFor={`contract_show_${artist.id}`}>Show</label><select id={`contract_show_${artist.id}`} name="show_id" required>{assignedShows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
              <ContractFields idPrefix={`contract_${artist.id}`} currency={workspace.organization.baseCurrency} defaultFrom={nextMonthStart} />
              <div className="field full"><SubmitButton className="button primary small" type="submit" pendingLabel="Creating…">Create contract</SubmitButton></div>
            </form></details> : <span className="muted">No assigned show</span>}</td></tr>}
        </Fragment>;
      })}
      {!artists?.length && <tr><td colSpan={4}><div className="emptyState">No artists have been added yet.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
