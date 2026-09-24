import Link from "next/link";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptInvitation, registerPartner } from "./actions";
import { Brand } from "@/components/brand";

type InviteInfo = { organizationName: string; email: string; expiresAt: string; accepted: boolean; expired: boolean };

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ token }, { error }] = await Promise.all([params, searchParams]);
  const publicClient = createSupabasePublicClient();
  const { data } = publicClient ? await publicClient.rpc("get_partner_invitation_v1", { p_token: token }) : { data: null };
  const invite = data as InviteInfo | null;
  const serverClient = await createSupabaseServerClient();
  const { data: { user } } = await serverClient.auth.getUser();

  const unavailable = !invite || invite.accepted || invite.expired;
  return <div className="publicShell authShell"><main className="card authCard">
    <Brand />
    <p className="eyebrow">Partner invitation</p>
    {unavailable ? <><h1>Invitation unavailable</h1><p className="lede">This link is invalid, expired or has already been accepted. Ask the owner for a new invitation.</p><Link className="button authButton" href="/login">Go to sign in</Link></> : <>
      <h1>Join {invite.organizationName}</h1><p className="lede">You were invited as a partner using <strong>{invite.email}</strong>.</p>
      {error && <div className="notice danger">{error}</div>}
      {user ? <form action={acceptInvitation} className="formGrid authForm"><input type="hidden" name="token" value={token} /><div className="field full"><p className="notice">Signed in as {user.email}. Accept to join the workspace.</p></div><div className="field full"><button className="button primary" type="submit">Accept invitation</button></div></form> : <form action={registerPartner} className="formGrid authForm">
        <input type="hidden" name="token" value={token} />
        <div className="field full"><label htmlFor="invite_name">Full name</label><input id="invite_name" name="full_name" autoComplete="name" required /></div>
        <div className="field full"><label htmlFor="invite_email">Email</label><input id="invite_email" name="email" type="email" value={invite.email} readOnly /></div>
        <div className="field full"><label htmlFor="invite_password">Create password</label><input id="invite_password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
        <div className="field full"><button className="button primary" type="submit">Create account and join</button></div>
        <div className="field full"><p className="authFooter">Already registered? <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to accept</Link></p></div>
      </form>}
    </>}
  </main></div>;
}
