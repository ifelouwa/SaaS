import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireActiveSubscription } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/prisma";
import { plans } from "@/lib/plans";
import { StaffView, type StaffWithDetails, type ServiceOption } from "./staff-view";

async function StaffContent() {
  const { salon } = await requireActiveSubscription();

  if (!salon) {
    return null;
  }

  const prisma = getPrisma();

  // Load all staff with schedules and service assignments
  const rawStaff = await prisma.staff.findMany({
    where: { salonId: salon.id },
    include: {
      schedules: {
        orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      },
      services: {
        select: { serviceId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Load all active services for the service assignment checklist
  const rawServices = await prisma.service.findMany({
    where: { salonId: salon.id, active: true },
    select: { id: true, name: true, durationMinutes: true, priceCents: true },
    orderBy: { name: "asc" },
  });

  // Determine plan limits
  const planId = salon.subscription?.plan ?? "STARTER";
  const planConfig = plans.find((p) => p.id === planId);
  const planLimit = planConfig?.staffLimit ?? null;
  const allowSplitShifts = planConfig?.allowSplitShifts ?? false;

  const staffList: StaffWithDetails[] = rawStaff.map((s) => ({
    id: s.id,
    name: s.name,
    title: s.title,
    email: s.email,
    active: s.active,
    schedules: s.schedules.map((sc) => ({
      id: sc.id,
      dayOfWeek: sc.dayOfWeek,
      startMinute: sc.startMinute,
      endMinute: sc.endMinute,
    })),
    serviceIds: s.services.map((sv) => sv.serviceId),
  }));

  const services: ServiceOption[] = rawServices.map((svc) => ({
    id: svc.id,
    name: svc.name,
    durationMinutes: svc.durationMinutes,
    priceCents: svc.priceCents,
  }));

  return (
    <>
      {/* Page header */}
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
            <span className="text-xs text-accent">Staff Roster</span>
          </div>
          <h1 className="mt-1 font-display text-4xl text-white tracking-tight">
            Staff &amp; Shifts
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage stylists, weekly availability, and service assignments for{" "}
            <span className="text-white">{salon.name}</span>.
          </p>
        </div>

        <Link
          href={`/book/${salon.slug}`}
          target="_blank"
          className="rounded-full border border-line bg-card px-4 py-2 text-xs text-muted hover:text-white transition"
        >
          View Booking Page ↗
        </Link>
      </div>

      {/* Tip banner when no staff yet */}
      {staffList.length === 0 && (
        <div className="mb-6 rounded-xl border border-blue-800/30 bg-blue-900/10 px-4 py-3 text-sm text-blue-300">
          👋 Add your first stylist, then set their weekly availability and assign
          the services they offer — clients will only see slots where a stylist is
          scheduled for the chosen service.
        </div>
      )}

      <StaffView
        staffList={staffList}
        services={services}
        plan={planId as "STARTER" | "GROWTH"}
        planLimit={planLimit}
        allowSplitShifts={allowSplitShifts}
      />
    </>
  );
}

export default function StaffPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Suspense
          fallback={
            <div className="py-24 text-center text-muted animate-pulse">
              Loading staff roster…
            </div>
          }
        >
          <StaffContent />
        </Suspense>
      </main>
    </div>
  );
}
