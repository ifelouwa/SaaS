"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { simulateSubscriptionStatusAction } from "@/app/actions/auth";
import { SubscriptionStatus, Plan } from "@/generated/prisma/enums";

type Props = {
  salonId: string;
  currentStatus: SubscriptionStatus;
  currentPlan: Plan;
  hasStripeCustomer: boolean;
};

export function BillingControls({
  salonId,
  currentStatus,
  currentPlan,
  hasStripeCustomer,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const handleCheckout = async (plan: "STARTER" | "GROWTH") => {
    setIsLoadingStripe(true);
    setStripeError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setStripeError((err as Error).message || "Checkout failed");
      setIsLoadingStripe(false);
    }
  };

  const handleCustomerPortal = async () => {
    setIsLoadingStripe(true);
    setStripeError(null);

    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setStripeError((err as Error).message || "Customer portal failed");
      setIsLoadingStripe(false);
    }
  };

  const handleStatusChange = (status: SubscriptionStatus) => {
    startTransition(async () => {
      await simulateSubscriptionStatusAction(salonId, status);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Stripe Actions Card */}
      <div className="rounded-2xl border border-line bg-card p-6">
        <h3 className="font-display text-xl text-white">Stripe Subscription Actions</h3>
        <p className="mt-1 text-xs text-muted">
          Subscribe, switch plan tiers, or manage payment methods and receipts directly through Stripe.
        </p>

        {stripeError && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
            {stripeError}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isLoadingStripe}
            onClick={() => handleCheckout(currentPlan === "STARTER" ? "GROWTH" : "STARTER")}
            className="rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isLoadingStripe
              ? "Connecting to Stripe..."
              : currentPlan === "STARTER"
              ? "Upgrade to Growth Plan ($79/mo) →"
              : "Switch to Starter Plan ($29/mo) →"}
          </button>

          {hasStripeCustomer && (
            <button
              type="button"
              disabled={isLoadingStripe}
              onClick={handleCustomerPortal}
              className="rounded-xl border border-line bg-background px-4 py-2.5 text-xs text-muted hover:text-white transition disabled:opacity-50"
            >
              Open Stripe Customer Portal ↗
            </button>
          )}
        </div>
      </div>

      {/* Development & Verification Simulator */}
      <div className="rounded-2xl border border-line bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-white">Interactive Subscription Guard Simulator</h3>
            <p className="mt-1 text-xs text-muted">
              Toggle between tenant subscription states to test the middleware and tenant guard behavior live.
            </p>
          </div>
          {isPending && (
            <span className="text-xs text-accent animate-pulse">Updating status...</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={isPending || currentStatus === "ACTIVE"}
            onClick={() => handleStatusChange("ACTIVE")}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition ${
              currentStatus === "ACTIVE"
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                : "border border-line bg-background text-muted hover:text-white"
            }`}
          >
            ● Set to ACTIVE (Access Granted)
          </button>

          <button
            type="button"
            disabled={isPending || currentStatus === "TRIALING"}
            onClick={() => handleStatusChange("TRIALING")}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition ${
              currentStatus === "TRIALING"
                ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
                : "border border-line bg-background text-muted hover:text-white"
            }`}
          >
            ● Set to TRIALING (14-Day Trial)
          </button>

          <button
            type="button"
            disabled={isPending || currentStatus === "PAST_DUE"}
            onClick={() => handleStatusChange("PAST_DUE")}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition ${
              currentStatus === "PAST_DUE"
                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                : "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            }`}
          >
            ⚠ Set to PAST_DUE (Trigger Guard Redirect)
          </button>

          <button
            type="button"
            disabled={isPending || currentStatus === "CANCELED"}
            onClick={() => handleStatusChange("CANCELED")}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition ${
              currentStatus === "CANCELED"
                ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
                : "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
            }`}
          >
            ✕ Set to CANCELED (Trigger Guard Redirect)
          </button>
        </div>
      </div>
    </div>
  );
}
