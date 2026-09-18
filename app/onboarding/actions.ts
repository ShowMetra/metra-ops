"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (name.length < 2 || slug.length < 2) redirect("/onboarding?error=Enter+a+company+name+and+slug");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const findMembership = () => supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const { data: existingMembership } = await findMembership();
  if (existingMembership) redirect("/dashboard");

  const { error } = await supabase.rpc("create_organization_v1", { p_name: name, p_slug: slug });
  if (error) {
    if (error.code === "23505") {
      const { data: membershipCreatedByAnotherRequest } = await findMembership();
      if (membershipCreatedByAnotherRequest) redirect("/dashboard");
      redirect("/onboarding?error=This+workspace+slug+is+already+taken");
    }
    redirect("/onboarding?error=Could+not+create+the+workspace.+Please+try+again");
  }

  redirect("/dashboard");
}
