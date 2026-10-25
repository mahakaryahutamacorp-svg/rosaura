"use client";

import { useEffect, useRef } from "react";
import { clearCustomerDisplayAction, publishCustomerDisplayAction } from "@/app/actions/operations";
import type { CustomerBill } from "@/lib/display";

let sequence = 0;

function nextStamp() {
  sequence += 1;
  return `${Date.now()}${String(sequence).padStart(4, "0")}`;
}

export function CustomerBillSync({ bill }: { bill: CustomerBill | null }) {
  const billRef = useRef(bill);
  billRef.current = bill;
  const serialized = JSON.stringify(bill);

  useEffect(() => {
    let stopped = false;

    async function publish() {
      const current = billRef.current;
      if (!current || stopped) return;
      await publishCustomerDisplayAction({ ...current, stamp: nextStamp() });
    }

    async function clear() {
      await clearCustomerDisplayAction(nextStamp());
    }

    if (billRef.current) void publish();
    else void clear();

    const timer = window.setInterval(() => {
      if (billRef.current) void publish();
    }, 8000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      void clear();
    };
  }, [serialized]);

  return null;
}
