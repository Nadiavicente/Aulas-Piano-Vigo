"use client";

import { useActionState } from "react";
import { loginAdmin } from "./actions";
import type { LoginFormState } from "@/app/login/actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<LoginFormState | undefined, FormData>(
    loginAdmin,
    undefined
  );

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-ink/20 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-ink/20 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-ink px-4 py-2 font-medium text-gold-light transition hover:bg-ink-light disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
