"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { fieldClass, labelClass, primaryButton, secondaryButton } from "@/lib/styles";

const demos = [
  { label: "Owner", email: "lidya@rosaura.local", detail: "Uang masuk dan piutang" },
  { label: "Front Office", email: "rina@rosaura.local", detail: "Booking dan kasir" },
  { label: "Klinis", email: "sinta@rosaura.local", detail: "Jadwal dan catatan" },
  { label: "Gudang", email: "agus@rosaura.local", detail: "Stok dan kedaluwarsa" },
];

export function LoginForm() {
  const [email, setEmail] = useState("rina@rosaura.local");
  const [password, setPassword] = useState("rosaura123");
  const [state, action, pending] = useActionState(loginAction, { error: "" });

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          className={fieldClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="password">
          Kata sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={fieldClass}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {state.error ? <p className="text-sm text-[#8a3d36]">{state.error}</p> : null}
      <button className={`${primaryButton} w-full`} type="submit" disabled={pending}>
        {pending ? "Memeriksa..." : "Masuk"}
      </button>
      <div className="grid gap-2 pt-2 sm:grid-cols-2">
        {demos.map((demo) => (
          <button
            key={demo.email}
            type="button"
            className={`${secondaryButton} h-auto flex-col items-start px-3 py-2 text-left`}
            onClick={() => {
              setEmail(demo.email);
              setPassword("rosaura123");
            }}
          >
            <span>{demo.label}</span>
            <span className="text-xs font-normal text-muted">{demo.detail}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">Kata sandi semua akun contoh: rosaura123</p>
    </form>
  );
}
