import { InvitePartnerForm } from "@/components/invite-partner-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";

export default async function TeamPage() {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "owner") redirect("/dashboard");
  const supabase = await createSupabaseServerClient();

  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    supabase.from("organization_members").select("user_id, role, status, created_at").eq("organization_id", workspace.organization.id).order("created_at"),
    supabase.from("organization_invitations").select("id, email, expires_at, accepted_at, created_at").eq("organization_id", workspace.organization.id).order("created_at", { ascending: false }),
  ]);
  const userIds = memberships?.map(item => item.user_id) ?? [];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]));

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Access management</p><h1>Team</h1><p className="lede">Invite partners and manage who can access the Remarc Entertainment workspace.</p></div></div>
    <div className="grid2">
      <section className="card"><div className="sectionHeader"><h2>Invite partner</h2><span className="badge brand">Owner only</span></div><div className="sectionBody"><InvitePartnerForm /></div></section>
      <section className="card"><div className="sectionHeader"><h2>Members</h2><span className="badge">{memberships?.length ?? 0}</span></div><div className="sectionBody"><div className="list">
        {(memberships ?? []).map(member => {
          const profile = profileMap.get(member.user_id);
          return <div className="listItem" key={member.user_id}><div><div className="strong">{profile?.full_name || profile?.email || "Team member"}</div><div className="sub">{profile?.email || "Email unavailable"}</div></div><span className={`badge ${member.role === "owner" ? "brand" : "success"}`}>{member.role}</span></div>;
        })}
      </div></div></section>
    </div>
    <section className="card section"><div className="sectionHeader"><h2>Invitation history</h2></div><div className="sectionBody tableWrap"><table><thead><tr><th>Email</th><th>Created</th><th>Expires</th><th>Status</th></tr></thead><tbody>
      {(invitations ?? []).map(invite => {
        const expired = new Date(invite.expires_at) <= new Date();
        const status = invite.accepted_at ? "Accepted" : expired ? "Expired" : "Pending";
        return <tr key={invite.id}><td className="strong">{invite.email}</td><td>{new Date(invite.created_at).toLocaleDateString("en-GB")}</td><td>{new Date(invite.expires_at).toLocaleDateString("en-GB")}</td><td><span className={`badge ${status === "Accepted" ? "success" : status === "Pending" ? "warning" : "danger"}`}>{status}</span></td></tr>;
      })}
      {!invitations?.length && <tr><td colSpan={4}><div className="emptyState">No invitations yet.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
