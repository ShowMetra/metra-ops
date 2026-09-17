import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export default async function ShowsPage() {
  await requireWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: shows }, { data: cast }, { data: performances }, { data: links }] = await Promise.all([
    supabase.from("shows").select("id, name, description, status, partner_user_id").order("name"),
    supabase.from("show_artists").select("show_id"),
    supabase.from("performances").select("show_id"),
    supabase.from("schedule_share_links").select("show_id, is_active"),
  ]);

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Operations</p><h1>Shows</h1><p className="lede">Your assigned shows, casts and public schedule status.</p></div></div>
    <div className="showGrid">{(shows ?? []).map(show => {
      const artistCount = cast?.filter(item => item.show_id === show.id).length ?? 0;
      const performanceCount = performances?.filter(item => item.show_id === show.id).length ?? 0;
      const hasLink = links?.some(item => item.show_id === show.id && item.is_active) ?? false;
      return <article className="card showCard" key={show.id}><div className="showTop"><div><h2>{show.name}</h2><div className="sub">{show.description || "No description"}</div></div><span className={`badge ${show.status === "active" ? "success" : "warning"}`}>{show.status}</span></div><div className="showMeta"><div><span>Artists</span><strong>{artistCount}</strong></div><div><span>Performances</span><strong>{performanceCount}</strong></div><div><span>Schedule link</span><strong>{hasLink ? "Active" : "Not created"}</strong></div><div><span>Access</span><strong>Assigned team</strong></div></div></article>;
    })}</div>
    {!shows?.length && <div className="card emptyCard"><div className="emptyState"><strong>No shows yet.</strong><br />Create the first show after the owner invites the responsible partner.</div></div>}
  </>;
}
