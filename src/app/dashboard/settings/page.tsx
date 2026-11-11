import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireActiveSubscription } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/prisma";
import {
  SettingsView,
  type SalonProfileData,
  type SalonHourData,
} from "./settings-view";

async function SettingsContent() {
  const { salon } = await requireActiveSubscription();

  if (!salon) {
    return null;
  }

  const prisma = getPrisma();

  // Load latest salon details including hours
  const fullSalon = await prisma.salon.findUnique({
    where: { id: salon.id },
    include: {
      hours: {
        orderBy: { dayOfWeek: "asc" },
      },
    },
  });

  if (!fullSalon) {
    return null;
  }

  const salonData: SalonProfileData = {
    id: fullSalon.id,
    name: fullSalon.name,
    slug: fullSalon.slug,
    phone: fullSalon.phone,
    email: fullSalon.email,
    addressLine: fullSalon.addressLine,
    city: fullSalon.city,
    timezone: fullSalon.timezone,
  };

  const hoursData: SalonHourData[] = fullSalon.hours.map((h) => ({
    dayOfWeek: h.dayOfWeek,
    closed: h.closed,
    startMinute: h.startMinute,
    endMinute: h.endMinute,
  }));

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs text-muted hover:text-white transition"
            >
              Dashboard
            </Link>
            <span className="text-xs text-muted">/</span>
            <span className="text-xs text-accent">Salon Settings</span>
          </div>
          <h1 className="mt-1 font-display text-4xl text-white tracking-tight">
            Salon Settings
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage your salon&apos;s contact details, public booking slug, timezone, and weekly operating hours.
          </p>
        </div>

        <Link
          href={`/book/${fullSalon.slug}`}
          target="_blank"
          className="rounded-full border border-line bg-card px-4 py-2 text-xs text-muted hover:text-white transition"
        >
          View Client Booking Page ↗
        </Link>
      </div>

      <SettingsView salon={salonData} hours={hoursData} />
    </>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <Suspense
          fallback={
            <div className="py-24 text-center text-muted animate-pulse">
              Loading salon settings…
            </div>
          }
        >
          <SettingsContent />
        </Suspense>
      </main>
    </div>
  );
}
