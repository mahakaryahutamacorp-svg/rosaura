"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { recordPaymentAction } from "@/app/actions/operations";
import { formatRupiah } from "@/lib/format";
import { fieldClass, labelClass, primaryButton } from "@/lib/styles";

export function PaymentForm({ invoiceId, remaining }: { invoiceId: string; remaining: number }) {
  const [key] = useState(() => crypto.randomUUID());

  return (
    <form action={recordPaymentAction} className="grid gap-3 rounded-2xl border border-line bg-ivory p-4 md:grid-cols-[1fr_160px_auto] md:items-end">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <label>
        <span className={labelClass}>Metode</span>
        <select name="method" className={fieldClass} defaultValue="CASH">
          <option value="CASH">Tunai</option>
          <option value="TRANSFER">Transfer</option>
          <option value="QRIS">QRIS</option>
        </select>
      </label>
      <label>
        <span className={labelClass}>Nominal</span>
        <input name="amount" type="number" min={1} max={remaining} defaultValue={remaining} className={fieldClass} required />
      </label>
      <PayButton remaining={remaining} />
    </form>
  );
}

function PayButton({ remaining }: { remaining: number }) {
  const { pending } = useFormStatus();
  return (
    <button className={primaryButton} type="submit" disabled={pending}>
      {pending ? "Mencatat..." : `Terima ${formatRupiah(remaining)}`}
    </button>
  );
}
