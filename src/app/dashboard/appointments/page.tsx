import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireActiveSubscription } from "@/lib/auth-helpers";
import { getPrisma } from "@/lib/prisma";
import { AppointmentsView, SerializedAppointment } from "./appointments-view";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

function getTodayString() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

async function AppointmentsContent({ searchParams }: Props) {
  const { date } = await searchParams;
  const { salon } = await requireActiveSubscription();

  if (!salon) {
    return null;
  }

  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getTodayString();
  const [yearStr, monthStr, dayStr] = selectedDate.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  const prisma = getPrisma();

  // Load appointments for selected day
  let appointments = await prisma.appointment.findMany({
    where: {
      salonId: salon.id,
      startsAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      service: true,
      staff: true,
    },
    orderBy: {
      startsAt: "asc",
    },
  });

  // Load active staff and services
  const staffList = await prisma.staff.findMany({
    where: { salonId: salon.id, active: true },
    select: { id: true, name: true, title: true },
    orderBy: { name: "asc" },
  });

  const servicesList = await prisma.service.findMany({
    where: { salonId: salon.id, active: true },
    select: { id: true, name: true, durationMinutes: true, priceCents: true },
    orderBy: { priceCents: "asc" },
  });

  // If this salon has zero appointments today and has staff and services, create 2 realistic appointments for demo testing
  if (appointments.length === 0 && staffList.length > 0 && servicesList.length > 0 && selectedDate === getTodayString()) {
    const srv1 = servicesList[0];
    const srv2 = servicesList[1] || servicesList[0];
    const st1 = staffList[0];
    const st2 = staffList[1] || staffList[0];

    const appt1Start = new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
    const appt1End = new Date(appt1Start.getTime() + srv1.durationMinutes * 60 * 1000);

    const appt2Start = new Date(Date.UTC(year, month - 1, day, 14, 30, 0));
    const appt2End = new Date(appt2Start.getTime() + srv2.durationMinutes * 60 * 1000);

    await prisma.appointment.createMany({
      data: [
        {
          salonId: salon.id,
          staffId: st1.id,
          serviceId: srv1.id,
          customerName: "Sophia Loren",
          customerEmail: "sophia@example.com",
          customerPhone: "(212) 555-0144",
          startsAt: appt1Start,
          endsAt: appt1End,
          status: "CONFIRMED",
          notes: "Prefers organic shampoo and requested quiet service.",
        },
        {
          salonId: salon.id,
          staffId: st2.id,
          serviceId: srv2.id,
          customerName: "Liam Hemsworth",
          customerEmail: "liam@example.com",
          customerPhone: "(212) 555-0177",
          startsAt: appt2Start,
          endsAt: appt2End,
          status: "CONFIRMED",
          notes: "Walk-in consultation for trim and scalp treatment.",
        },
      ],
    });

    appointments = await prisma.appointment.findMany({
      where: {
        salonId: salon.id,
        startsAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        service: true,
        staff: true,
      },
      orderBy: {
        startsAt: "asc",
      },
    });
  }

  const serialized: SerializedAppointment[] = appointments.map((a) => ({
    id: a.id,
    customerName: a.customerName,
    customerEmail: a.customerEmail,
    customerPhone: a.customerPhone,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    notes: a.notes,
    service: {
      id: a.service.id,
      name: a.service.name,
      durationMinutes: a.service.durationMinutes,
      priceCents: a.service.priceCents,
    },
    staff: {
      id: a.staff.id,
      name: a.staff.name,
      title: a.staff.title,
    },
  }));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs text-muted hover:text-white transition"
            >
              Dashboard
            </Link>
            <span className="text-xs text-muted">/</span>
            <span className="text-xs text-accent">Appointment Book</span>
          </div>
          <h1 className="mt-1 font-display text-4xl text-white tracking-tight">Today&apos;s Book</h1>
          <p className="mt-1 text-sm text-muted">
            Manage daily schedule, client check-ins, walk-ins, and service statuses for{" "}
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

      <AppointmentsView
        selectedDate={selectedDate}
        appointments={serialized}
        staffList={staffList}
        servicesList={servicesList}
      />
    </>
  );
}

export default function AppointmentsPage({ searchParams }: Props) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Suspense
          fallback={
            <div className="py-24 text-center text-muted animate-pulse">
              Loading appointment book...
            </div>
          }
        >
          <AppointmentsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
