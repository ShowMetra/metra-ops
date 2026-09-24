import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createExpense } from "./actions";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [{ error, message }, workspace] = await Promise.all([searchParams, requireWorkspace()]);
  const supabase = await createSupabaseServerClient();
  const [{ data: shows }, { data: expenses }] = await Promise.all([
    supabase.from("shows").select("id, name").eq("status", "planned").order("name"),
    supabase.from("expenses").select("id, expense_date, category, description, amount, currency, paid_by, status, shows(name)").order("expense_date", { ascending: false }).limit(30),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return <>
    <div className="pageHeader"><div><p className="eyebrow">{workspace.membership.role === "partner" ? "Partner workspace" : "Owner review"}</p><h1>Expenses</h1><p className="lede">Partners submit expenses for their shows. The owner reviews them before closing the month.</p></div></div>
    {error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    <div className="grid2">
      {workspace.membership.role === "partner" && <section className="card"><div className="sectionHeader"><h2>New expense</h2><span className="badge">Draft or submit</span></div><div className="sectionBody">
        {shows?.length ? <form action={createExpense} className="formGrid">
          <div className="field"><label htmlFor="expense_show">Show</label><select id="expense_show" name="show_id" required>{shows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></div>
          <div className="field"><label htmlFor="expense_date">Date</label><input id="expense_date" name="expense_date" type="date" defaultValue={today} required /></div>
          <div className="field"><label htmlFor="expense_category">Category</label><select id="expense_category" name="category"><option>Transport</option><option>Accommodation</option><option>Props</option><option>Costumes</option><option>Equipment</option><option>Food</option><option>Other</option></select></div>
          <div className="field"><label htmlFor="expense_amount">Amount ({workspace.organization.baseCurrency})</label><input id="expense_amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" required /></div>
          <div className="field"><label htmlFor="expense_payer">Paid by</label><select id="expense_payer" name="paid_by"><option value="partner">Partner</option><option value="company">Company</option></select></div>
          <div className="field full"><label htmlFor="expense_description">Comment</label><textarea id="expense_description" name="description" rows={3} placeholder="What was this expense for?" /></div>
          <div className="field full buttonRow"><SubmitButton name="intent" value="draft" className="button" type="submit" pendingLabel="Saving…">Save draft</SubmitButton><SubmitButton name="intent" value="submitted" className="button primary" type="submit" pendingLabel="Submitting…">Submit to owner</SubmitButton></div>
        </form> : <div className="emptyState">Create or assign a show before adding an expense.</div>}
      </div></section>}
      <section className="card"><div className="sectionHeader"><h2>Recent expenses</h2><span className="badge">{expenses?.length ?? 0}</span></div><div className="sectionBody"><div className="list">
        {(expenses ?? []).map(expense => {
          const show = Array.isArray(expense.shows) ? expense.shows[0] : expense.shows;
          return <div className="listItem" key={expense.id}><div><div className="strong">{expense.category} · {new Intl.NumberFormat("en-GB", { style: "currency", currency: expense.currency }).format(expense.amount)}</div><div className="sub">{show?.name ?? "Show"} · {new Date(`${expense.expense_date}T00:00:00Z`).toLocaleDateString("en-GB")} · Paid by {expense.paid_by}</div></div><span className={`badge ${expense.status === "approved" ? "success" : expense.status === "rejected" ? "danger" : "warning"}`}>{expense.status}</span></div>;
        })}
        {!expenses?.length && <div className="emptyState">No expenses yet.</div>}
      </div></div></section>
    </div>
  </>;
}
