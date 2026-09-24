import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createShow } from "./actions";

export default async function ShowsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const [{ data: shows }, { data: cast }, { data: performances }, { data: links }] = await Promise.all([
    supabase.from("shows").select("id, name, code, description, partner_user_id").order("name"),
    supabase.from("show_artists").select("show_id"),
    supabase.from("performances").select("show_id"),
    supabase.from("schedule_share_links").select("show_id, is_active"),
  ]);

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Operations</p><h1>Shows</h1><p className="lede">Your assigned shows, casts and public schedule status.</p></div></div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    {workspace.membership.role === "partner" && <section className="card" style={{ marginBottom: 22 }}><div className="sectionHeader"><h2>Create show</h2><span className="badge brand">Partner</span></div><div className="sectionBody">
      <form action={createShow} className="formGrid">
        <div className="field"><label htmlFor="show_name">Show name</label><input id="show_name" name="name" required /></div>
        <div className="field"><label htmlFor="show_code">Internal code</label><input id="show_code" name="code" placeholder="Optional" /></div>
        <div className="field full"><label htmlFor="show_description">Description</label><textarea id="show_description" name="description" rows={3} /></div>
        <div className="field full"><SubmitButton className="button primary" type="submit" pendingLabel="Creating show…">Create show</SubmitButton></div>
      </form>
    </div></section>}
    <div className="showGrid">{(shows ?? []).map(show => {
      const artistCount = cast?.filter(item => item.show_id === show.id).length ?? 0;
      const performanceCount = performances?.filter(item => item.show_id === show.id).length ?? 0;
      const hasLink = links?.some(item => item.show_id === show.id && item.is_active) ?? false;
      return <article className="card showCard" key={show.id}>
        <div className="showTop"><div><h2>{show.name}</h2><div className="sub">{show.code ? `${show.code} · ` : ""}{show.description || "No description"}</div></div></div>
        <div className="showMeta"><div><span>Artists</span><strong>{artistCount}</strong></div><div><span>Calendar entries</span><strong>{performanceCount}</strong></div><div><span>Schedule link</span><strong>{hasLink ? "Active" : "Not created"}</strong></div><div><span>Access</span><strong>{workspace.membership.role === "partner" ? "Assigned" : "Read only"}</strong></div></div>
      </article>;
    })}</div>
    {!shows?.length && <div className="card emptyCard"><div className="emptyState"><strong>No shows yet.</strong><br />Create the first show after the owner invites the responsible partner.</div></div>}
  </>;
}
