"use client";

import { secondaryButton } from "@/lib/styles";

export function PrintButton() {
  return (
    <button className={`${secondaryButton} no-print`} type="button" onClick={() => window.print()}>
      Cetak struk
    </button>
  );
}
