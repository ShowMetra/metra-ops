import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createShow, deleteShow, finishShow, updateShow } from "./actions";

export default async function ShowsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const [{ data: shows }, { data: cast }, { data: performances }, { data: links }] = await Promise.all([
    supabase.from("shows").select("id, name, code, description, status, partner_user_id, finished_at").order("name"),
    supabase.from("show_artists").select("show_id"),
    supabase.from("performances").select("show_id, starts_at, ends_at, status"),
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
      const showPerformances = performances?.filter(item => item.show_id === show.id) ?? [];
      const performanceCount = showPerformances.length;
      const hasFuturePerformance = showPerformances.some(item => item.status === "planned" && new Date(item.ends_at || item.starts_at) > new Date());
      const canFinish = performanceCount > 0 && !hasFuturePerformance;
      const hasLink = links?.some(item => item.show_id === show.id && item.is_active) ?? false;
      const editable = workspace.membership.role === "partner" && show.status === "planned";
      return <article className="card showCard" key={show.id}>
        <div className="showTop"><div><h2>{show.name}</h2><div className="sub">{show.code ? `${show.code} · ` : ""}{show.description || "No description"}</div></div><span className={`badge ${show.status === "finished" ? "success" : "brand"}`}>{show.status === "finished" ? "Finished" : "Planned"}</span></div>
        <div className="showMeta"><div><span>Artists</span><strong>{artistCount}</strong></div><div><span>Performances</span><strong>{performanceCount}</strong></div><div><span>Finance</span><strong>{show.status === "finished" ? "Included" : "After finish"}</strong></div><div><span>Access</span><strong>{show.status === "finished" ? "Locked" : editable ? "Editable" : "Read only"}</strong></div></div>
        {show.status === "finished" && <div className="helpText">Finished {show.finished_at ? new Date(show.finished_at).toLocaleDateString("en-GB", { timeZone: workspace.organization.timezone }) : ""}. This show can no longer be changed or deleted.</div>}
        {editable && <>
          <details className="showEditor"><summary>Edit show details</summary><form action={updateShow} className="formGrid compactForm">
            <input name="show_id" type="hidden" value={show.id} />
            <div className="field"><label htmlFor={`show_name_${show.id}`}>Show name</label><input id={`show_name_${show.id}`} name="name" defaultValue={show.name} required /></div>
            <div className="field"><label htmlFor={`show_code_${show.id}`}>Internal code</label><input id={`show_code_${show.id}`} name="code" defaultValue={show.code || ""} /></div>
            <div className="field full"><label htmlFor={`show_description_${show.id}`}>Description</label><textarea id={`show_description_${show.id}`} name="description" defaultValue={show.description || ""} rows={3} /></div>
            <div className="field full"><SubmitButton className="button primary small" type="submit" pendingLabel="Saving…">Save changes</SubmitButton></div>
          </form></details>
          <div className="showActions">
            <form action={finishShow}><input name="show_id" type="hidden" value={show.id} /><ConfirmSubmitButton className="button primary small" type="submit" disabled={!canFinish} pendingLabel="Finishing…" confirmMessage="Finish this show? Its past performances will be locked and included in Monthly Finance.">Finish show</ConfirmSubmitButton></form>
            <form action={deleteShow}><input name="show_id" type="hidden" value={show.id} /><ConfirmSubmitButton className="button danger small" type="submit" pendingLabel="Deleting…" confirmMessage="Delete this planned show and all of its related schedule and financial records? This cannot be undone.">Delete show</ConfirmSubmitButton></form>
          </div>
          {!canFinish && <div className="helpText">{performanceCount === 0 ? "Add at least one performance before finishing." : "Finish is available after the last planned performance ends."}</div>}
        </>}
        <div className="helpText">Schedule link: {hasLink ? "Active" : "Not created"}</div>
      </article>;
    })}</div>
    {!shows?.length && <div className="card emptyCard"><div className="emptyState"><strong>No shows yet.</strong><br />Create the first show after the owner invites the responsible partner.</div></div>}
  </>;
}
