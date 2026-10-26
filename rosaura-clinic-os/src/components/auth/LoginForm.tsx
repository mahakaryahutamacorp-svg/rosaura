"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { fieldClass, labelClass, primaryButton, secondaryButton } from "@/lib/styles";

const demos = [
  { label: "Dokter", email: "dokter@rosaura.id", password: "sayangsuami1" },
  { label: "Admin", email: "yaya@rosaura.id", password: "majubersama1" },
];

export function LoginForm() {
  const [email, setEmail] = useState(demos[1].email);
  const [password, setPassword] = useState(demos[1].password);
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
              setPassword(demo.password);
            }}
          >
            <span>{demo.label}</span>
            <span className="text-xs font-normal text-muted">{demo.email}</span>
          </button>
        ))}
      </div>
    </form>
  );
}
