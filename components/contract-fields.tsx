"use client";

import { useState } from "react";

export function ContractFields({ idPrefix, currency, defaultFrom }: { idPrefix: string; currency: string; defaultFrom: string }) {
  const [paymentType, setPaymentType] = useState<"monthly" | "daily">("monthly");

  return <>
    <div className="field full"><label htmlFor={`${idPrefix}_type`}>Payment type</label><select id={`${idPrefix}_type`} name="payment_type" value={paymentType} onChange={event => setPaymentType(event.target.value as "monthly" | "daily")}><option value="monthly">Monthly salary</option><option value="daily">Daily rate</option></select></div>
    {paymentType === "monthly" ? <>
      <div className="field"><label htmlFor={`${idPrefix}_salary`}>Monthly salary ({currency})</label><input id={`${idPrefix}_salary`} name="monthly_salary" type="number" min="0" step="0.01" defaultValue="0" required /></div>
      <div className="field"><label htmlFor={`${idPrefix}_extra`}>Extra day rate ({currency})</label><input id={`${idPrefix}_extra`} name="extra_day_rate" type="number" min="0" step="0.01" defaultValue="0" required /></div>
    </> : <div className="field full"><label htmlFor={`${idPrefix}_daily`}>Daily rate ({currency})</label><input id={`${idPrefix}_daily`} name="daily_rate" type="number" min="0.01" step="0.01" placeholder="0.00" required /></div>}
    <div className="field"><label htmlFor={`${idPrefix}_from`}>Valid from</label><input id={`${idPrefix}_from`} name="valid_from" type="date" defaultValue={defaultFrom} required /></div>
    <div className="field"><label htmlFor={`${idPrefix}_to`}>Valid until</label><input id={`${idPrefix}_to`} name="valid_to" type="date" /></div>
    <div className="field full"><span className="helpText">Valid until is optional. A new later contract automatically closes the previous open contract.</span></div>
  </>;
}
