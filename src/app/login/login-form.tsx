"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginOwnerAction, AuthActionResult } from "@/app/actions/auth";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    loginOwnerAction,
    null
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {state?.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-muted">
          Email address
        </label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="owner@your-salon.com"
          className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Password
          </label>
        </div>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Signing in..." : "Sign in to Dashboard"}
      </button>

      <p className="pt-2 text-center text-sm text-muted">
        Don&apos;t have a salon account yet?{" "}
        <Link href="/register" className="text-accent underline">
          Register your salon
        </Link>
      </p>
    </form>
  );
}
