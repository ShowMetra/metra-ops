"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const invoiceUrl = (message: string, type: "message" | "error" = "error", month?: string) =>
  `/invoices?${month ? `month=${encodeURIComponent(month)}&` : ""}${type}=${encodeURIComponent(message)}`;

export async function saveInvoiceSettings(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "owner") redirect("/dashboard");

  const billingName = String(formData.get("billing_name") ?? "").trim();
  const billingAddress = String(formData.get("billing_address") ?? "").trim();
  const billingTaxId = String(formData.get("billing_tax_id") ?? "").trim();
  const billingIban = String(formData.get("billing_iban") ?? "").trim();
  const billingBankName = String(formData.get("billing_bank_name") ?? "").trim();
  const paymentTerms = Number(formData.get("invoice_payment_terms_days"));
  const taxRate = Number(formData.get("invoice_tax_rate"));
  const invoiceNotes = String(formData.get("invoice_notes") ?? "").trim();

  if (billingName.length < 2) redirect(invoiceUrl("Enter the company legal name."));
  if (!Number.isInteger(paymentTerms) || paymentTerms < 0 || paymentTerms > 90) {
    redirect(invoiceUrl("Payment terms must be between 0 and 90 days."));
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    redirect(invoiceUrl("VAT rate must be between 0 and 100%."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("organizations").update({
    billing_name: billingName,
    billing_address: billingAddress || null,
    billing_tax_id: billingTaxId || null,
    billing_iban: billingIban || null,
    billing_bank_name: billingBankName || null,
    invoice_payment_terms_days: paymentTerms,
    invoice_tax_rate: taxRate,
    invoice_notes: invoiceNotes || null,
  }).eq("id", workspace.organization.id);

  if (error) redirect(invoiceUrl("Could not save the invoice settings."));
  revalidatePath("/invoices");
  redirect(invoiceUrl("Invoice settings saved.", "message"));
}

export async function createHotelInvoice(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "owner") redirect("/dashboard");

  const hotelId = String(formData.get("hotel_id") ?? "");
  const month = String(formData.get("billing_month") ?? "");
  if (!uuidPattern.test(hotelId) || !monthPattern.test(month)) {
    redirect(invoiceUrl("Choose a valid hotel and billing month.", "error", month));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_hotel_invoice_v1", {
    p_organization_id: workspace.organization.id,
    p_hotel_id: hotelId,
    p_billing_month: `${month}-01`,
  });

  if (error) {
    const reason = error.message.includes("already exists")
      ? "An invoice already exists for this hotel and month."
      : error.message.includes("billing details")
        ? "Complete the company billing details first."
        : error.message.includes("without hotel rates")
          ? "Add rates for every finished performance before creating the invoice."
          : error.message.includes("no finished performances")
            ? "There are no finished performances to invoice."
            : "Could not create the invoice.";
    redirect(invoiceUrl(reason, "error", month));
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${data}?message=${encodeURIComponent("Invoice created.")}`);
}

export async function updateInvoiceStatus(formData: FormData) {
  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "owner") redirect("/dashboard");

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuidPattern.test(invoiceId) || !["sent", "paid", "void"].includes(status)) {
    redirect(invoiceUrl("Invalid invoice update."));
  }

  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase.from("invoices")
    .select("id, sent_at")
    .eq("id", invoiceId)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  if (!invoice) redirect(invoiceUrl("Invoice not found."));

  const { error } = await supabase.from("invoices").update({
    status,
    sent_at: status === "void" ? invoice.sent_at : invoice.sent_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", invoiceId).eq("organization_id", workspace.organization.id);
  if (error) redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("Could not update the invoice status.")}`);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?message=${encodeURIComponent(`Invoice marked ${status}.`)}`);
}
