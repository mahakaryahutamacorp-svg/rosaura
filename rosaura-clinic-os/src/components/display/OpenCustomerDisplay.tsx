"use client";

import { secondaryButton } from "@/lib/styles";

export function OpenCustomerDisplay() {
  return (
    <button
      className={secondaryButton}
      type="button"
      onClick={() => {
        window.open("/display", "rosaura-customer-display", "width=1280,height=720");
      }}
    >
      Buka layar pelanggan
    </button>
  );
}
