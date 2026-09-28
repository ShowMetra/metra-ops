import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { PrintInvoiceButton } from "@/components/print-invoice-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { updateInvoiceStatus } from "../actions";

type Invoice = {
  id: string;
  invoice_number: string;
  billing_month: string;
  issue_date: string;
  due_date: string;
  currency: string;
  status: "draft" | "sent" | "paid" | "void";
  issuer_name: string;
  issuer_address: string | null;
  issuer_tax_id: string | null;
  issuer_iban: string | null;
  issuer_bank_name: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_tax_id: string | null;
  customer_email: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
};

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string | string[]; error?: string | string[] }> }) {
  const [workspace, { id }, query] = await Promise.all([requireWorkspace(), params, searchParams]);
  if (workspace.membership.role !== "owner") redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const [{ data: invoiceData }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).eq("organization_id", workspace.organization.id).maybeSingle(),
    supabase.from("invoice_items").select("id, service_date, show_name, description, quantity, unit_price, discount, line_total, sort_order").eq("invoice_id", id).order("sort_order"),
  ]);
  if (!invoiceData) notFound();
  const invoice = invoiceData as Invoice;
  const message = typeof query.message === "string" ? query.message : "";
  const errorMessage = typeof query.error === "string" ? query.error : "";
  const money = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: invoice.currency }).format(Number(value));
  const date = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const month = new Date(`${invoice.billing_month.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const emailHref = invoice.customer_email
    ? `mailto:${invoice.customer_email}?subject=${encodeURIComponent(`Invoice ${invoice.invoice_number}`)}&body=${encodeURIComponent(`Hello,\n\nPlease find invoice ${invoice.invoice_number} for ${month}. The amount due is ${money(invoice.total)}.\n\nKind regards,\n${invoice.issuer_name}`)}`
    : "";

  return <>
    <div className="invoiceActions"><Link className="button" href={`/invoices?month=${invoice.billing_month.slice(0, 7)}`}>← All invoices</Link><div className="buttonRow">{emailHref && <a className="button" href={emailHref}>Email hotel</a>}<PrintInvoiceButton /></div></div>
    {message && <div className="notice success invoiceScreenOnly">{message}</div>}
    {errorMessage && <div className="notice danger invoiceScreenOnly">{errorMessage}</div>}
    <article className="invoiceDocument">
      <header className="invoiceDocumentHeader"><Brand className="invoiceBrand" /><div className="invoiceTitle"><span className={`badge invoiceStatus ${invoice.status}`}>{invoice.status}</span><h1>Invoice</h1><strong>{invoice.invoice_number}</strong></div></header>
      <section className="invoiceMeta"><div><span>Billing month</span><strong>{month}</strong></div><div><span>Issue date</span><strong>{date(invoice.issue_date)}</strong></div><div><span>Due date</span><strong>{date(invoice.due_date)}</strong></div></section>
      <section className="invoiceParties"><div><span className="invoiceLabel">From</span><h2>{invoice.issuer_name}</h2>{invoice.issuer_address && <p>{invoice.issuer_address}</p>}{invoice.issuer_tax_id && <p>VAT / Tax ID: {invoice.issuer_tax_id}</p>}</div><div><span className="invoiceLabel">Bill to</span><h2>{invoice.customer_name}</h2>{invoice.customer_address && <p>{invoice.customer_address}</p>}{invoice.customer_tax_id && <p>VAT / Tax ID: {invoice.customer_tax_id}</p>}{invoice.customer_email && <p>{invoice.customer_email}</p>}</div></section>
      <div className="tableWrap"><table className="invoiceItems"><thead><tr><th>Date</th><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Discount</th><th className="num">Amount</th></tr></thead><tbody>{(items ?? []).map(item => <tr key={item.id}><td>{date(item.service_date)}</td><td><strong>{item.show_name}</strong><div className="sub">{item.description}</div></td><td className="num">{Number(item.quantity)}</td><td className="num">{money(item.unit_price)}</td><td className="num">{Number(item.discount) ? `−${money(item.discount)}` : "—"}</td><td className="num strong">{money(item.line_total)}</td></tr>)}</tbody></table></div>
      <section className="invoiceBottom"><div className="invoicePayment"><span className="invoiceLabel">Payment details</span>{invoice.issuer_bank_name && <p><strong>Bank:</strong> {invoice.issuer_bank_name}</p>}{invoice.issuer_iban && <p><strong>IBAN:</strong> {invoice.issuer_iban}</p>}{invoice.notes && <p className="invoiceNotes">{invoice.notes}</p>}</div><div className="invoiceTotals"><div><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></div><div><span>VAT ({Number(invoice.tax_rate)}%)</span><strong>{money(invoice.tax_amount)}</strong></div><div className="invoiceGrandTotal"><span>Amount due</span><strong>{money(invoice.total)}</strong></div></div></section>
      <footer className="invoiceFooter">Generated by Remarc Entertainment · {invoice.invoice_number}</footer>
    </article>
    <section className="card invoiceStatusActions invoiceScreenOnly"><div><h2>Invoice status</h2><p className="sub">Save the PDF, email it to the hotel, then update its status here.</p></div><div className="buttonRow">{invoice.status === "draft" && <form action={updateInvoiceStatus}><input type="hidden" name="invoice_id" value={invoice.id} /><input type="hidden" name="status" value="sent" /><button className="button primary" type="submit">Mark as sent</button></form>}{invoice.status === "sent" && <form action={updateInvoiceStatus}><input type="hidden" name="invoice_id" value={invoice.id} /><input type="hidden" name="status" value="paid" /><button className="button primary" type="submit">Mark as paid</button></form>}{invoice.status !== "void" && invoice.status !== "paid" && <form action={updateInvoiceStatus}><input type="hidden" name="invoice_id" value={invoice.id} /><input type="hidden" name="status" value="void" /><button className="button danger" type="submit">Void invoice</button></form>}</div></section>
  </>;
}
