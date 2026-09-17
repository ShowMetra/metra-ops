import { AppShell } from "@/components/app-shell";
import { expenses } from "@/lib/demo-data";

export default function ExpensesPage() {
  return <AppShell section="Show expenses">
    <div className="pageHeader"><div><p className="eyebrow">Partner workspace</p><h1>Expenses</h1><p className="lede">Partners submit expenses for their shows. The owner reviews them before closing the month.</p></div><button className="button primary">Add expense</button></div>
    <div className="grid2">
      <section className="card"><div className="sectionHeader"><h2>New expense</h2><span className="badge">Draft</span></div><div className="sectionBody"><form className="formGrid">
        <div className="field"><label>Show</label><select defaultValue="Acrobatic Pirate"><option>Acrobatic Pirate</option><option>Fire Show I</option><option>Cuba Latin</option></select></div>
        <div className="field"><label>Date</label><input type="date" defaultValue="2026-09-17" /></div>
        <div className="field"><label>Category</label><select><option>Transport</option><option>Accommodation</option><option>Props</option><option>Costumes</option><option>Equipment</option><option>Other</option></select></div>
        <div className="field"><label>Amount</label><input inputMode="decimal" placeholder="0.00" /></div>
        <div className="field"><label>Paid by</label><select><option>Partner</option><option>Company</option><option>Artist</option></select></div>
        <div className="field"><label>Receipt</label><input type="file" /></div>
        <div className="field full"><label>Comment</label><textarea rows={3} placeholder="What was this expense for?" /></div>
        <div className="field full"><button type="button" className="button primary">Save draft</button></div>
      </form></div></section>
      <section className="card"><div className="sectionHeader"><h2>Recent submissions</h2></div><div className="sectionBody"><div className="list">{expenses.map(e => <div className="listItem" key={`${e.date}-${e.show}`}><div><div className="strong">{e.category} · €{e.amount}</div><div className="sub">{e.show} · {e.date} · Paid by {e.payer}</div></div><span className={`badge ${e.status === "Approved" ? "success" : "warning"}`}>{e.status}</span></div>)}</div></div></section>
    </div>
  </AppShell>;
}
