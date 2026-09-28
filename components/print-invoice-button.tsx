"use client";

export function PrintInvoiceButton() {
  return <button className="button primary" type="button" onClick={() => window.print()}>
    Print / Save PDF
  </button>;
}
