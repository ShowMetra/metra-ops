import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { archiveShow, createShow, restoreShow } from "./actions";

export default async function ShowsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const [{ data: shows }, { data: cast }, { data: performances }, { data: links }, { data: profiles }] = await Promise.all([
    supabase.from("shows").select("id, name, code, description, partner_user_id, status, archived_at").order("name"),
    supabase.from("show_artists").select("show_id"),
    supabase.from("performances").select("show_id"),
    supabase.from("schedule_share_links").select("show_id, is_active"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const partnerNames = new Map((profiles ?? []).map(profile => [profile.id, profile.full_name || profile.email || "Partner"]));
  const activeShows = (shows ?? []).filter(show => !show.archived_at);
  const archivedShows = (shows ?? []).filter(show => Boolean(show.archived_at));
  const isPartner = workspace.membership.role === "partner";

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Operations</p><h1>Shows</h1><p className="lede">Your assigned shows, casts and public schedule status.</p></div></div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    {isPartner && <section className="card" style={{ marginBottom: 22 }}><div className="sectionHeader"><h2>Create show</h2><span className="badge brand">Partner</span></div><div className="sectionBody">
      <form action={createShow} className="formGrid">
        <div className="field"><label htmlFor="show_name">Show name</label><input id="show_name" name="name" required /></div>
        <div className="field"><label htmlFor="show_code">Internal code</label><input id="show_code" name="code" placeholder="Optional" /></div>
        <div className="field full"><label htmlFor="show_description">Description</label><textarea id="show_description" name="description" rows={3} /></div>
        <div className="field full"><SubmitButton className="button primary" type="submit" pendingLabel="Creating show…">Create show</SubmitButton></div>
      </form>
    </div></section>}
    <div className="showGrid">{activeShows.map(show => {
      const artistCount = cast?.filter(item => item.show_id === show.id).length ?? 0;
      const performanceCount = performances?.filter(item => item.show_id === show.id).length ?? 0;
      const hasLink = links?.some(item => item.show_id === show.id && item.is_active) ?? false;
      return <article className="card showCard" key={show.id}>
        <div className="showTop"><div><h2>{show.name}</h2><div className="sub">{show.code ? `${show.code} · ` : ""}{show.description || "No description"}</div></div>{workspace.membership.role === "owner" && <span className="badge brand">Partner · {partnerNames.get(show.partner_user_id) ?? "Unknown"}</span>}</div>
        <div className="showMeta"><div><span>Artists</span><strong>{artistCount}</strong></div><div><span>Calendar entries</span><strong>{performanceCount}</strong></div><div><span>Schedule link</span><strong>{hasLink ? "Active" : "Not created"}</strong></div><div><span>Access</span><strong>{isPartner ? "Assigned" : "Read only"}</strong></div></div>
        {isPartner && show.status === "planned" && <form action={archiveShow}><input name="show_id" type="hidden" value={show.id} /><ConfirmSubmitButton className="button danger small" type="submit" pendingLabel="Archiving…" confirmMessage={`Archive ${show.name}? Its historical calendar and finance data will remain. Shows with future performances cannot be archived.`}>Archive show</ConfirmSubmitButton></form>}
      </article>;
    })}</div>
    {!activeShows.length && <div className="card emptyCard"><div className="emptyState"><strong>No active shows.</strong><br />Create a new show or restore one from the archive.</div></div>}
    {archivedShows.length > 0 && <details className="card section archivePanel"><summary><span><strong>Archived shows</strong><small>{archivedShows.length} hidden from planning and new records</small></span><span className="badge warning">{archivedShows.length}</span></summary><div className="sectionBody"><div className="archiveList">
      {archivedShows.map(show => <div className="archiveItem" key={show.id}><div><div className="strong">{show.name}</div><div className="sub">{show.code || show.description || "No description"}</div></div><div className="archiveItemActions"><span className="badge warning">Archived</span>{isPartner && show.status === "planned" && <form action={restoreShow}><input name="show_id" type="hidden" value={show.id} /><SubmitButton className="button small" type="submit" pendingLabel="Restoring…">Restore</SubmitButton></form>}</div></div>)}
    </div></div></details>}
  </>;
}
