import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { createHotelInvoice, saveInvoiceSettings } from "./actions";

type RevenueLine = { hotel_id: string; amount: number; rate_missing?: boolean };
type MonthCalculation = { revenueLines: RevenueLine[] };
type InvoiceRow = {
  id: string;
  hotel_id: string;
  invoice_number: string;
  billing_month: string;
  issue_date: string;
  due_date: string;
  total: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "void";
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const localMonth = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const value = (type: "year" | "month") => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}`;
};
const monthLabel = (month: string) => new Date(`${month.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string | string[]; message?: string | string[]; error?: string | string[] }> }) {
  const [workspace, query] = await Promise.all([requireWorkspace(), searchParams]);
  if (workspace.membership.role !== "owner") redirect("/dashboard");

  const currentMonth = localMonth(new Date(), workspace.organization.timezone);
  const requestedMonth = typeof query.month === "string" ? query.month : currentMonth;
  const month = monthPattern.test(requestedMonth) ? requestedMonth : currentMonth;
  const message = typeof query.message === "string" ? query.message : "";
  const errorMessage = typeof query.error === "string" ? query.error : "";
  const supabase = await createSupabaseServerClient();
  const [calculationResult, hotelsResult, invoicesResult, organizationResult] = await Promise.all([
    supabase.rpc("calculate_month_v1", {
      p_organization_id: workspace.organization.id,
      p_month: `${month}-01`,
    }),
    supabase.from("hotels").select("id, name, billing_name, billing_email").eq("organization_id", workspace.organization.id).order("name"),
    supabase.from("invoices").select("id, hotel_id, invoice_number, billing_month, issue_date, due_date, total, currency, status")
      .eq("organization_id", workspace.organization.id).order("billing_month", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("organizations").select("billing_name, billing_address, billing_tax_id, billing_iban, billing_bank_name, invoice_payment_terms_days, invoice_tax_rate, invoice_notes")
      .eq("id", workspace.organization.id).single(),
  ]);

  const calculation = calculationResult.data as MonthCalculation | null;
  const hotels = hotelsResult.data ?? [];
  const invoices = (invoicesResult.data ?? []) as InvoiceRow[];
  const organization = organizationResult.data;
  const totals = new Map<string, { count: number; missingRates: number; total: number }>();
  for (const line of calculation?.revenueLines ?? []) {
    const current = totals.get(line.hotel_id) ?? { count: 0, missingRates: 0, total: 0 };
    current.count += 1;
    current.missingRates += line.rate_missing ? 1 : 0;
    current.total += Number(line.amount);
    totals.set(line.hotel_id, current);
  }
  const invoiceByHotel = new Map(invoices.filter(invoice => invoice.billing_month.slice(0, 7) === month).map(invoice => [invoice.hotel_id, invoice]));
  const formatMoney = (value: number, currency = workspace.organization.baseCurrency) => new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(value));

  return <>
    <div className="pageHeader"><div><p className="eyebrow">Owner · Hotel billing</p><h1>Invoices</h1><p className="lede">Create one monthly invoice per hotel from finished, rated performances.</p></div><span className="badge brand">{monthLabel(month)}</span></div>
    {message && <div className="notice success">{message}</div>}
    {errorMessage && <div className="notice danger">{errorMessage}</div>}
    {calculationResult.error && <div className="notice danger">Could not calculate hotel billing for this month.</div>}

    <section className="card invoiceSettings">
      <div className="sectionHeader"><div><h2>Company billing details</h2><p className="sub">These details are saved into every new invoice.</p></div><span className={`badge ${organization?.billing_name ? "success" : "warning"}`}>{organization?.billing_name ? "Ready" : "Required"}</span></div>
      <div className="sectionBody"><form action={saveInvoiceSettings} className="formGrid">
        <div className="field"><label htmlFor="billing_name">Legal company name</label><input id="billing_name" name="billing_name" defaultValue={organization?.billing_name ?? workspace.organization.name} required /></div>
        <div className="field"><label htmlFor="billing_tax_id">VAT / Tax ID</label><input id="billing_tax_id" name="billing_tax_id" defaultValue={organization?.billing_tax_id ?? ""} /></div>
        <div className="field full"><label htmlFor="billing_address">Billing address</label><textarea id="billing_address" name="billing_address" rows={2} defaultValue={organization?.billing_address ?? ""} /></div>
        <div className="field"><label htmlFor="billing_iban">IBAN</label><input id="billing_iban" name="billing_iban" defaultValue={organization?.billing_iban ?? ""} /></div>
        <div className="field"><label htmlFor="billing_bank_name">Bank name</label><input id="billing_bank_name" name="billing_bank_name" defaultValue={organization?.billing_bank_name ?? ""} /></div>
        <div className="field"><label htmlFor="invoice_payment_terms_days">Payment terms (days)</label><input id="invoice_payment_terms_days" name="invoice_payment_terms_days" type="number" min="0" max="90" step="1" defaultValue={organization?.invoice_payment_terms_days ?? 14} required /></div>
        <div className="field"><label htmlFor="invoice_tax_rate">VAT rate (%)</label><input id="invoice_tax_rate" name="invoice_tax_rate" type="number" min="0" max="100" step="0.01" defaultValue={organization?.invoice_tax_rate ?? 0} required /></div>
        <div className="field full"><label htmlFor="invoice_notes">Default invoice note</label><textarea id="invoice_notes" name="invoice_notes" rows={2} defaultValue={organization?.invoice_notes ?? ""} placeholder="Payment reference, reverse charge note, or other terms" /></div>
        <div className="field full"><SubmitButton className="button primary" pendingLabel="Saving…">Save billing details</SubmitButton></div>
      </form></div>
    </section>

    <section className="card section"><div className="sectionHeader"><div><h2>Monthly invoice run</h2><p className="sub">Only performances that have already finished are included.</p></div></div><div className="sectionBody">
      <form method="get" className="invoiceMonthPicker"><div className="field"><label htmlFor="invoice_month">Billing month</label><input id="invoice_month" name="month" type="month" defaultValue={month} required /></div><button className="button" type="submit">Show month</button></form>
      <div className="tableWrap invoiceCandidates"><table><thead><tr><th>Hotel</th><th className="num">Finished shows</th><th className="num">Amount</th><th>Status</th><th className="num">Action</th></tr></thead><tbody>
        {hotels.map(hotel => {
          const total = totals.get(hotel.id);
          const invoice = invoiceByHotel.get(hotel.id);
          return <tr key={hotel.id}><td><div className="strong">{hotel.billing_name || hotel.name}</div><div className="sub">{hotel.billing_email || "No billing email"}</div></td><td className="num">{total?.count ?? 0}</td><td className="num strong">{formatMoney(total?.total ?? 0)}</td><td>{invoice ? <span className={`badge invoiceStatus ${invoice.status}`}>{invoice.status}</span> : total?.missingRates ? <span className="badge warning">{total.missingRates} missing rates</span> : <span className="badge">Not created</span>}</td><td className="num">{invoice ? <Link className="button small" href={`/invoices/${invoice.id}`}>Open</Link> : <form action={createHotelInvoice}><input type="hidden" name="hotel_id" value={hotel.id} /><input type="hidden" name="billing_month" value={month} /><SubmitButton className="button small primary" pendingLabel="Creating…" disabled={!organization?.billing_name || !total?.count || Boolean(total.missingRates)}>Create invoice</SubmitButton></form>}</td></tr>;
        })}
        {!hotels.length && <tr><td colSpan={5}><div className="emptyState">Add hotels before creating invoices.</div></td></tr>}
      </tbody></table></div>
    </div></section>

    <section className="card section"><div className="sectionHeader"><h2>Invoice history</h2><span className="badge">{invoices.length}</span></div><div className="sectionBody tableWrap"><table><thead><tr><th>Invoice</th><th>Hotel</th><th>Month</th><th>Due</th><th>Status</th><th className="num">Total</th></tr></thead><tbody>
      {invoices.map(invoice => <tr key={invoice.id}><td><Link className="invoiceLink" href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td><td>{hotels.find(hotel => hotel.id === invoice.hotel_id)?.billing_name || hotels.find(hotel => hotel.id === invoice.hotel_id)?.name || "Hotel"}</td><td>{monthLabel(invoice.billing_month)}</td><td>{new Date(`${invoice.due_date}T00:00:00Z`).toLocaleDateString("en-GB")}</td><td><span className={`badge invoiceStatus ${invoice.status}`}>{invoice.status}</span></td><td className="num strong">{formatMoney(invoice.total, invoice.currency)}</td></tr>)}
      {!invoices.length && <tr><td colSpan={6}><div className="emptyState">No invoices created yet.</div></td></tr>}
    </tbody></table></div></section>
  </>;
}
