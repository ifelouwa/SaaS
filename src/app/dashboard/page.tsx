import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireActiveSubscription } from "@/lib/auth-helpers";
import { signOutOwnerAction } from "@/app/actions/auth";

async function DashboardContent() {
  const { user, salon } = await requireActiveSubscription();

  const sections = [
    {
      title: "Today’s Book",
      count: `${salon?._count.appointments ?? 0} booked`,
      body: "Manage scheduled salon bookings, customer check-ins, and statuses.",
      href: `/dashboard/appointments`,
    },
    {
      title: "Staff & Stylists",
      count: `${salon?._count.staff ?? 0} stylists`,
      body: "Configure active stylist profiles, working hours, and split shifts.",
      href: `/dashboard/staff`,
    },
    {
      title: "Services Menu",
      count: `${salon?._count.services ?? 0} offerings`,
      body: "Edit service durations, pricing, and stylist assignments.",
      href: `/dashboard/services`,
    },
    {
      title: "Salon Settings",
      count: `${salon?.timezone ?? "Default"}`,
      body: "Manage address, booking link slug, timezone, and operating hours.",
      href: `/dashboard/settings`,
    },
    {
      title: "Software Subscription",
      count: `${salon?.subscription?.plan} • ${salon?.subscription?.status}`,
      body: "View your subscription tier, billing period, and invoice receipts.",
      href: `/dashboard/billing`,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Owner Workspace</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{salon?.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="text-white">{user.name}</span> ({user.email})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/book/${salon?.slug}`}
            target="_blank"
            className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white transition hover:opacity-90"
          >
            View Public Booking Page ↗
          </Link>
          <form action={signOutOwnerAction}>
            <button
              type="submit"
              className="rounded-full border border-line bg-card px-4 py-2 text-xs text-muted hover:text-white transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Tenant Status Bar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          <span className="text-sm text-white font-medium">Tenant Guard: Active Subscription</span>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
            {salon?.subscription?.status}
          </span>
        </div>

        <div className="text-xs text-muted">
          Public link:{" "}
          <Link href={`/book/${salon?.slug}`} className="text-accent underline font-mono">
            /book/{salon?.slug}
          </Link>
        </div>
      </div>

      {/* Operations Panels */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="group rounded-2xl border border-line bg-card p-6 transition hover:border-accent/40 hover:bg-card/80"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl group-hover:text-accent transition">
                {section.title}
              </h2>
              <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
                {section.count}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{section.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Suspense
          fallback={
            <div className="py-20 text-center text-muted animate-pulse">
              Loading salon workspace...
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  );
}
