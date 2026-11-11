import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireActiveSubscription } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/prisma";
import {
  ServicesView,
  type ServiceWithStaff,
  type StaffMemberOption,
} from "./services-view";

async function ServicesContent() {
  const { salon } = await requireActiveSubscription();

  if (!salon) {
    return null;
  }

  const prisma = getPrisma();

  // Load all salon services with their staff relations and appointment counts
  const rawServices = await prisma.service.findMany({
    where: { salonId: salon.id },
    include: {
      staff: {
        select: { staffId: true },
      },
      _count: {
        select: { appointments: true },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  // Load all salon staff so owners can assign qualified staff to services
  const rawStaff = await prisma.staff.findMany({
    where: { salonId: salon.id },
    select: {
      id: true,
      name: true,
      title: true,
      active: true,
    },
    orderBy: { name: "asc" },
  });

  const services: ServiceWithStaff[] = rawServices.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    priceCents: s.priceCents,
    active: s.active,
    staffIds: s.staff.map((st) => st.staffId),
    appointmentCount: s._count.appointments,
  }));

  const allStaff: StaffMemberOption[] = rawStaff.map((st) => ({
    id: st.id,
    name: st.name,
    title: st.title,
    active: st.active,
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
            <span className="text-xs text-accent">Services Menu</span>
          </div>
          <h1 className="mt-1 font-display text-4xl text-white tracking-tight">
            Services Menu
          </h1>
          <p className="mt-1 text-sm text-muted">
            Configure appointment services, pricing, durations, and assign qualified stylists for{" "}
            <span className="text-white">{salon.name}</span>.
          </p>
        </div>

        <Link
          href={`/book/${salon.slug}`}
          target="_blank"
          className="rounded-full border border-line bg-card px-4 py-2 text-xs text-muted hover:text-white transition"
        >
          View Client Booking Page ↗
        </Link>
      </div>

      <ServicesView services={services} allStaff={allStaff} />
    </>
  );
}

export default function ServicesPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Suspense
          fallback={
            <div className="py-24 text-center text-muted animate-pulse">
              Loading salon services menu…
            </div>
          }
        >
          <ServicesContent />
        </Suspense>
      </main>
    </div>
  );
}
