"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerOwnerAction, AuthActionResult } from "@/app/actions/auth";
import { plans, formatMonthlyPrice } from "@/lib/plans";

export function RegisterForm() {
  const [selectedPlan, setSelectedPlan] = useState<"STARTER" | "GROWTH">("STARTER");
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    registerOwnerAction,
    null
  );

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state?.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-display text-lg">1. Salon & Account Details</h3>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Owner Full Name
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="Jane Doe"
            className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Work Email Address
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="owner@velvethair.com"
            className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Password (min 6 characters)
          </label>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            placeholder="••••••••"
            className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Salon Name
          </label>
          <input
            type="text"
            name="salonName"
            required
            placeholder="Velvet Studio & Spa"
            className="mt-2 w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white placeholder-muted/60 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Custom Booking URL Slug (Optional)
          </label>
          <div className="mt-2 flex rounded-xl border border-line bg-card text-sm text-muted">
            <span className="flex items-center pl-4 text-xs select-none">/book/</span>
            <input
              type="text"
              name="slug"
              placeholder="velvet-studio"
              className="w-full bg-transparent px-2 py-3 text-white placeholder-muted/60 focus:outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-muted">Your public booking link for clients.</p>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-line">
        <h3 className="font-display text-lg">2. Select Software Subscription</h3>
        <p className="text-xs text-muted">
          All plans include a 14-day free trial. You won&apos;t be billed today.
        </p>

        <input type="hidden" name="plan" value={selectedPlan} />

        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <button
                type="button"
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                    : "border-line bg-card hover:border-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base text-white">{plan.name}</span>
                  {isSelected && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white uppercase">
                      Selected
                    </span>
                  )}
                </div>
                <div className="mt-2 font-display text-2xl text-white">
                  {formatMonthlyPrice(plan.priceMonthlyCents)}
                  <span className="ml-1 text-xs font-normal text-muted">/mo</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{plan.summary}</p>
                <p className="mt-3 text-[11px] text-accent">
                  {plan.staffLimit === null ? "Unlimited staff" : `Up to ${plan.staffLimit} staff`}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Creating your salon workspace..." : "Start 14-Day Free Trial"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have a subscription?{" "}
        <Link href="/login" className="text-accent underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
