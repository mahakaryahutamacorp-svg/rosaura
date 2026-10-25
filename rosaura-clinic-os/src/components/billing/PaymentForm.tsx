"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { recordPaymentAction } from "@/app/actions/operations";
import { CustomerBillSync } from "@/components/display/CustomerBillSync";
import type { DisplayLine } from "@/lib/display";
import { formatRupiah } from "@/lib/format";
import { fieldClass, labelClass, primaryButton } from "@/lib/styles";

export function PaymentForm({
  invoiceId,
  clientName,
  lines,
  subtotal,
  grandTotal,
  paid,
}: {
  invoiceId: string;
  clientName: string;
  lines: DisplayLine[];
  subtotal: number;
  grandTotal: number;
  paid: number;
}) {
  const currentDiscount = Math.max(subtotal - grandTotal, 0);
  const [key] = useState(() => crypto.randomUUID());
  const [method, setMethod] = useState("CASH");
  const [discountText, setDiscountText] = useState(String(currentDiscount));
  const [amountText, setAmountText] = useState(String(Math.max(grandTotal - paid, 0)));
  const [cashText, setCashText] = useState("");
  const [transferText, setTransferText] = useState("");

  const discount = wholeNumber(discountText);
  const due = discount === null ? 0 : subtotal - discount - paid;
  const amount = wholeNumber(amountText);
  const cash = wholeNumber(cashText);
  const transfer = wholeNumber(transferText);
  const discountReady = discount !== null && discount <= subtotal && due >= 0;
  const splitReady = cash !== null && transfer !== null && cash > 0 && transfer > 0 && cash + transfer === due;
  const singleReady = amount !== null && amount > 0 && amount <= due;
  const canSubmit = discountReady && (due === 0 || (method === "SPLIT" ? splitReady : singleReady));
  const shownDiscount = discount !== null && discount <= subtotal ? discount : currentDiscount;
  const displayLines = [
    ...lines,
    ...(shownDiscount > 0 ? [{ name: "Diskon", quantity: 1, amount: -shownDiscount }] : []),
    ...(paid > 0 ? [{ name: "Sudah dibayar", quantity: 1, amount: -paid }] : []),
  ];

  return (
    <form action={recordPaymentAction} className="no-print grid gap-3 rounded-2xl border border-line bg-ivory p-4">
      <CustomerBillSync bill={{ clientName, lines: displayLines, total: Math.max(subtotal - shownDiscount - paid, 0) }} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="discount" value={discount ?? 0} />
      <input type="hidden" name="method" value={due === 0 ? "CASH" : method} />
      <input type="hidden" name="amount" value={method === "SPLIT" ? (cash ?? 0) : (amount ?? 0)} />
      <input type="hidden" name="transferAmount" value={method === "SPLIT" ? (transfer ?? 0) : 0} />

      <label className="max-w-xs">
        <span className={labelClass}>Diskon (Rp)</span>
        <input
          className={fieldClass}
          inputMode="numeric"
          value={discountText}
          onChange={(event) => setDiscountText(event.target.value.replace(/[^\d]/g, ""))}
        />
      </label>
      {discount !== null && due < 0 ? <p className="text-sm text-[#8a3d36]">Diskon melebihi sisa yang belum diterima.</p> : null}

      <fieldset>
        <legend className={labelClass}>Metode</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["CASH", "Tunai"],
            ["QRIS", "QRIS"],
            ["TRANSFER", "Transfer"],
            ["SPLIT", "Sebagian tunai, sebagian transfer"],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
              <input type="radio" name="methodChoice" value={value} checked={method === value} onChange={() => setMethod(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {method === "SPLIT" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Tunai</span>
            <input className={fieldClass} inputMode="numeric" value={cashText} onChange={(event) => setCashText(event.target.value.replace(/[^\d]/g, ""))} />
          </label>
          <label>
            <span className={labelClass}>Transfer</span>
            <input className={fieldClass} inputMode="numeric" value={transferText} onChange={(event) => setTransferText(event.target.value.replace(/[^\d]/g, ""))} />
          </label>
          <p className="text-sm text-muted sm:col-span-2">Keduanya harus berjumlah {formatRupiah(Math.max(due, 0))}.</p>
        </div>
      ) : (
        <label className="max-w-xs">
          <span className={labelClass}>Nominal</span>
          <input
            className={fieldClass}
            inputMode="numeric"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value.replace(/[^\d]/g, ""))}
          />
        </label>
      )}

      <PayButton disabled={!canSubmit} due={Math.max(due, 0)} paying={method === "SPLIT" ? Math.max(due, 0) : (amount ?? 0)} />
    </form>
  );
}

function wholeNumber(value: string) {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

function PayButton({ disabled, due, paying }: { disabled: boolean; due: number; paying: number }) {
  const { pending } = useFormStatus();
  return (
    <button className={`${primaryButton} w-fit`} type="submit" disabled={disabled || pending}>
      {pending ? "Mencatat..." : due === 0 ? "Simpan diskon" : `Terima ${formatRupiah(paying)}`}
    </button>
  );
}
