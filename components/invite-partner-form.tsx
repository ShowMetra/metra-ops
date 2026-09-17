"use client";

import { invitePartner, type InviteState } from "@/app/(dashboard)/team/actions";
import { useActionState, useState } from "react";

const initialState: InviteState = {};

export function InvitePartnerForm() {
  const [state, formAction, pending] = useActionState(invitePartner, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
  }

  return <form action={formAction} className="formGrid">
    <div className="field full"><label htmlFor="partner_email">Partner email</label><input id="partner_email" name="email" type="email" defaultValue={state.email} placeholder="partner@example.com" required /></div>
    {state.error && <div className="field full"><span className="badge danger">{state.error}</span></div>}
    {state.inviteUrl && <div className="field full">
      <label>Invitation link · valid for 7 days</label>
      <div className="copyRow"><input value={state.inviteUrl} readOnly /><button className="button" type="button" onClick={copyLink}>{copied ? "Copied" : "Copy"}</button></div>
      <span className="helpText">Send this private link to {state.email}. The partner must sign up with the same email.</span>
    </div>}
    <div className="field full"><button className="button primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create invitation"}</button></div>
  </form>;
}
