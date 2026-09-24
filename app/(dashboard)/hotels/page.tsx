import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createHotel, createHotelRate } from "./actions";

export default async function HotelsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const [{ data: hotels }, { data: shows }, { data: rates }] = await Promise.all([
    supabase.from("hotels").select("id, name, address, billing_name, billing_email, tax_id, status").order("name"),
    supabase.from("shows").select("id, name").eq("status", "planned").order("name"),
    supabase.from("hotel_show_rates").select("id, price_per_performance, currency, valid_from, valid_to, hotels(name), shows(name)").order("valid_from", { ascending: false }),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Organization directory</p><h1>Hotels & rates</h1><p className="lede">The owner maintains one hotel list. Partners reuse it for performances and rates.</p></div></div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    <div className="grid2">
      {workspace.membership.role === "owner" && <section className="card"><div className="sectionHeader"><h2>Add hotel</h2><span className="badge brand">Owner only</span></div><div className="sectionBody">
        <form action={createHotel} className="formGrid">
          <div className="field full"><label htmlFor="hotel_name">Hotel name</label><input id="hotel_name" name="name" required /></div>
          <div className="field full"><label htmlFor="hotel_address">Address</label><input id="hotel_address" name="address" /></div>
          <div className="field"><label htmlFor="hotel_billing_name">Billing name</label><input id="hotel_billing_name" name="billing_name" /></div>
          <div className="field"><label htmlFor="hotel_billing_email">Billing email</label><input id="hotel_billing_email" name="billing_email" type="email" /></div>
          <div className="field full"><label htmlFor="hotel_tax_id">Tax ID</label><input id="hotel_tax_id" name="tax_id" /></div>
          <div className="field full"><SubmitButton className="button primary" type="submit" pendingLabel="Creating hotel…">Create hotel</SubmitButton></div>
        </form>
      </div></section>}
      {workspace.membership.role === "partner" && <section className="card"><div className="sectionHeader"><h2>Add hotel rate</h2><span className="badge">Per performance</span></div><div className="sectionBody">
        {hotels?.length && shows?.length ? <form action={createHotelRate} className="formGrid">
          <div className="field"><label htmlFor="rate_hotel">Hotel</label><select id="rate_hotel" name="hotel_id" required>{hotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></div>
          <div className="field"><label htmlFor="rate_show">Show</label><select id="rate_show" name="show_id" required>{shows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
          <div className="field"><label htmlFor="rate_price">Price ({workspace.organization.baseCurrency})</label><input id="rate_price" name="price_per_performance" type="number" min="0" step="0.01" required /></div>
          <div className="field"><label htmlFor="rate_from">Valid from</label><input id="rate_from" name="valid_from" type="date" defaultValue={today} required /></div>
          <div className="field full"><SubmitButton className="button primary" type="submit" pendingLabel="Creating rate…">Create rate</SubmitButton></div>
        </form> : <div className="emptyState">Create a hotel and an assigned show before adding a rate.</div>}
      </div></section>}
    </div>
    <section className="card section"><div className="sectionHeader"><h2>Hotel directory</h2><span className="badge">{hotels?.length ?? 0}</span></div><div className="sectionBody tableWrap"><table><thead><tr><th>Hotel</th><th>Address</th><th>Billing</th><th>Status</th></tr></thead><tbody>
      {(hotels ?? []).map(hotel => <tr key={hotel.id}><td className="strong">{hotel.name}</td><td>{hotel.address || "—"}</td><td><div>{hotel.billing_name || "—"}</div><div className="sub">{hotel.billing_email || hotel.tax_id || "No billing details"}</div></td><td><span className={`badge ${hotel.status === "active" ? "success" : "warning"}`}>{hotel.status}</span></td></tr>)}
      {!hotels?.length && <tr><td colSpan={4}><div className="emptyState">No hotels yet.</div></td></tr>}
    </tbody></table></div></section>
    <section className="card section"><div className="sectionHeader"><h2>Current rates</h2><span className="badge">{rates?.length ?? 0}</span></div><div className="sectionBody tableWrap"><table><thead><tr><th>Hotel</th><th>Show</th><th>Valid from</th><th className="num">Rate</th></tr></thead><tbody>
      {(rates ?? []).map(rate => {
        const hotel = Array.isArray(rate.hotels) ? rate.hotels[0] : rate.hotels;
        const show = Array.isArray(rate.shows) ? rate.shows[0] : rate.shows;
        return <tr key={rate.id}><td className="strong">{hotel?.name ?? "Hotel"}</td><td>{show?.name ?? "Show"}</td><td>{new Date(`${rate.valid_from}T00:00:00Z`).toLocaleDateString("en-GB")}</td><td className="num strong">{new Intl.NumberFormat("en-GB", { style: "currency", currency: rate.currency }).format(rate.price_per_performance)}</td></tr>;
      })}
      {!rates?.length && <tr><td colSpan={4}><div className="emptyState">No rates yet.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
