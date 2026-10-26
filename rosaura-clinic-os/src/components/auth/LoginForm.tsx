"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { fieldClass, labelClass, primaryButton } from "@/lib/styles";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    </form>
  );
}
