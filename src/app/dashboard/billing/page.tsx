import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAuthOwner } from "@/lib/auth-helpers";
import { plans, formatMonthlyPrice } from "@/lib/plans";
import { BillingControls } from "./billing-controls";

type Props = {
  searchParams: Promise<{ reason?: string; success?: string; canceled?: string }>;
};

async function BillingContent({ searchParams }: Props) {
  const { reason, success, canceled } = await searchParams;
  const ownerData = await requireAuthOwner();
  const salon = ownerData.salon;
  const subscription = salon?.subscription;

  const currentStatus = subscription?.status ?? "INCOMPLETE";
  const currentPlan = subscription?.plan ?? "STARTER";
  const planInfo = plans.find((p) => p.id === currentPlan) || plans[0];

  const isGuardBlocked =
    reason === "past_due" ||
    reason === "canceled" ||
    reason === "trial_expired" ||
    reason === "unpaid" ||
    currentStatus === "PAST_DUE" ||
    currentStatus === "CANCELED" ||
    currentStatus === "INCOMPLETE";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Subscription & Invoicing</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Billing Portal</h1>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full border border-line bg-card px-4 py-2 text-xs text-muted hover:text-white transition"
        >
          ← Return to Dashboard
        </Link>
      </div>

      {/* Success Notification */}
      {success === "true" && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">✓</span>
            <div>
              <h3 className="font-display text-base font-medium text-emerald-200">
                Subscription Activated!
              </h3>
              <p className="mt-1 text-sm text-emerald-300/80 leading-relaxed">
                Thank you for subscribing. Your Stripe payment has been confirmed and full access to
                your salon scheduling system is active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Canceled Notification */}
      {canceled === "true" && (
        <div className="mt-6 rounded-2xl border border-line bg-card p-5 text-muted">
          <p className="text-sm">
            Stripe Checkout session was canceled. Your previous subscription status remains unchanged.
          </p>
        </div>
      )}

      {/* Subscription Guard Alert Banner */}
      {isGuardBlocked && (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-display text-base font-medium text-amber-200">
                {currentStatus === "PAST_DUE"
                  ? "Subscription Payment Past Due"
                  : currentStatus === "CANCELED"
                  ? "Subscription Inactive / Canceled"
                  : "Subscription Action Required"}
              </h3>
              <p className="mt-1 text-sm text-amber-300/80 leading-relaxed">
                The tenant guard redirected you here because your software subscription is{" "}
                <strong>{currentStatus}</strong>. Salon bookings and dashboard operations are
                temporarily locked until billing is restored.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Overview */}
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-6 sm:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-muted">Current Software Tier</span>
              <h2 className="mt-1 font-display text-3xl text-white">{planInfo.name} Plan</h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                currentStatus === "ACTIVE"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : currentStatus === "TRIALING"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}
            >
              {currentStatus}
            </span>
          </div>

          <p className="mt-4 text-sm text-muted leading-relaxed">{planInfo.summary}</p>

          <div className="mt-6 flex flex-wrap items-baseline gap-2 border-t border-line pt-6">
            <span className="font-display text-4xl text-white">
              {formatMonthlyPrice(planInfo.priceMonthlyCents)}
            </span>
            <span className="text-sm text-muted">/ month billed to salon owner</span>
          </div>

          {subscription?.currentPeriodEnd && (
            <p className="mt-2 text-xs text-muted">
              Current billing period ends:{" "}
              <span className="text-white">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-card p-6">
          <span className="text-xs uppercase tracking-wider text-muted">Salon Tenant</span>
          <p className="mt-2 font-display text-xl text-white">{salon?.name ?? "No Salon Found"}</p>
          <p className="mt-1 text-xs text-muted">
            Owner: <span className="text-white">{ownerData.user.email}</span>
          </p>

          <div className="mt-6 space-y-3 border-t border-line pt-6 text-xs text-muted">
            <div className="flex justify-between">
              <span>Staff Limit:</span>
              <span className="text-white font-medium">
                {planInfo.staffLimit ? `${planInfo.staffLimit} stylists` : "Unlimited"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Active Stylists:</span>
              <span className="text-white font-medium">{salon?._count?.staff ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Services:</span>
              <span className="text-white font-medium">{salon?._count?.services ?? 0}</span>
            </div>
            {subscription?.stripeCustomerId && (
              <div className="flex justify-between pt-2 border-t border-line">
                <span>Stripe ID:</span>
                <span className="font-mono text-accent">{subscription.stripeCustomerId.slice(0, 14)}...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls & Simulator */}
      {salon && (
        <div className="mt-8">
          <BillingControls
            salonId={salon.id}
            currentStatus={currentStatus}
            currentPlan={currentPlan}
            hasStripeCustomer={Boolean(subscription?.stripeCustomerId)}
          />
        </div>
      )}
    </>
  );
}

export default function BillingPage({ searchParams }: Props) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <Suspense
          fallback={
            <div className="py-20 text-center text-muted animate-pulse">
              Loading billing portal...
            </div>
          }
        >
          <BillingContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
