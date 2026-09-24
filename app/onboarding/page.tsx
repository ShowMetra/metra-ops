import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createOrganization } from "./actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");
  const { data: member } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (member) redirect("/dashboard");

  return <div className="publicShell authShell"><main className="card authCard">
    <div className="brand"><span className="brandMark">R</span>Remarc Entertainment</div>
    <p className="eyebrow">One final step</p><h1>Create the company</h1><p className="lede">This becomes your private workspace. You can invite partners after setup.</p>
    <form action={createOrganization} className="formGrid authForm">
      <div className="field full"><label htmlFor="organization_name">Company name</label><input id="organization_name" name="name" defaultValue="Remarc Entertainment" required /></div>
      <div className="field full"><label htmlFor="organization_slug">Workspace slug</label><input id="organization_slug" name="slug" defaultValue="remarc-entertainment" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></div>
      {error && <div className="field full"><span className="badge danger">{error}</span></div>}
      <div className="field full"><button className="button primary" type="submit">Create workspace</button></div>
    </form>
  </main></div>;
}
