"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createExpense(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "partner") redirect("/expenses?error=Only+partners+can+create+expenses");
  const showId = String(formData.get("show_id") ?? "");
  const expenseDate = String(formData.get("expense_date") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const paidBy = String(formData.get("paid_by") ?? "partner");
  const status = String(formData.get("intent") ?? "draft") === "submitted" ? "submitted" : "draft";
  if (!showId || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || !category || !Number.isFinite(amount) || amount <= 0 || !["partner", "company"].includes(paidBy)) {
    redirect("/expenses?error=Complete+the+required+expense+fields");
  }

  const supabase = await createSupabaseServerClient();
  const { data: show } = await supabase
    .from("shows")
    .select("id")
    .eq("id", showId)
    .eq("organization_id", workspace.organization.id)
    .eq("partner_user_id", workspace.user.id)
    .eq("status", "planned")
    .is("archived_at", null)
    .maybeSingle();
  if (!show) redirect("/expenses?error=Choose+one+of+your+planned+shows");

  const { error } = await supabase.from("expenses").insert({
    organization_id: workspace.organization.id,
    show_id: showId,
    expense_date: expenseDate,
    category,
    description: description || null,
    amount,
    currency: workspace.organization.baseCurrency,
    paid_by: paidBy,
    status,
    created_by: workspace.user.id,
  });
  if (error) redirect("/expenses?error=Could+not+save+the+expense");
  revalidatePath("/expenses");
  redirect(`/expenses?message=${status === "submitted" ? "Expense+submitted" : "Draft+saved"}`);
}

export async function deleteExpense(formData: FormData) {
  const workspace = await requireWorkspace();
  const expenseId = String(formData.get("expense_id") ?? "");
  if (!expenseId) redirect("/expenses?error=Expense+not+found");

  const supabase = await createSupabaseServerClient();
  let expenseQuery = supabase.from("expenses")
    .select("id, status, created_by")
    .eq("id", expenseId)
    .eq("organization_id", workspace.organization.id)
    .in("status", ["draft", "rejected"]);
  if (workspace.membership.role === "partner") expenseQuery = expenseQuery.eq("created_by", workspace.user.id);
  const { data: expense } = await expenseQuery.maybeSingle();
  if (!expense) redirect("/expenses?error=Only+your+draft+or+rejected+expenses+can+be+deleted");

  const { data: deleted, error } = await supabase.from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("organization_id", workspace.organization.id)
    .in("status", ["draft", "rejected"])
    .select("id")
    .maybeSingle();
  if (error || !deleted) redirect("/expenses?error=Could+not+delete+the+expense.+The+month+may+be+closed");

  revalidatePath("/expenses");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  redirect("/expenses?message=Expense+deleted");
}
