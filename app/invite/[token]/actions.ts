"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function cleanToken(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) redirect("/login?error=Invalid+invitation");
  return token;
}

export async function acceptInvitation(formData: FormData) {
  const token = cleanToken(formData);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { error } = await supabase.rpc("accept_partner_invitation_v1", { p_token: token });
  if (error) redirect(`/invite/${token}?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function registerPartner(formData: FormData) {
  const token = cleanToken(formData);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (fullName.length < 2 || password.length < 8) redirect(`/invite/${token}?error=Use+a+name+and+password+of+at+least+8+characters`);

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}`,
    },
  });
  if (error) redirect(`/invite/${token}?error=${encodeURIComponent(error.message)}`);

  if (data.session) {
    const { error: acceptError } = await supabase.rpc("accept_partner_invitation_v1", { p_token: token });
    if (acceptError) redirect(`/invite/${token}?error=${encodeURIComponent(acceptError.message)}`);
    redirect("/dashboard");
  }
  redirect(`/login?message=Check+your+email+to+confirm+the+account&next=${encodeURIComponent(`/invite/${token}`)}`);
}
