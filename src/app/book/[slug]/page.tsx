import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getPrisma } from "@/lib/prisma";
import { seedDemoSalonAction } from "@/app/actions/booking";
import { BookingWizard } from "./booking-wizard";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function BookingContent({ params }: PageProps) {
  const { slug } = await params;
  const prisma = getPrisma();

  let salon = await prisma.salon.findUnique({
    where: { slug },
    include: {
      services: {
        where: { active: true },
        orderBy: { priceCents: "asc" },
      },
      staff: {
        where: { active: true },
        include: {
          services: {
            select: { serviceId: true },
          },
        },
      },
    },
  });

  // If visiting demo-salon and it hasn't been seeded yet, auto-seed with sample stylists & services
  if ((!salon || salon.services.length === 0) && slug === "demo-salon") {
    await seedDemoSalonAction("demo-salon");
    salon = await prisma.salon.findUnique({
      where: { slug: "demo-salon" },
      include: {
        services: {
          where: { active: true },
          orderBy: { priceCents: "asc" },
        },
        staff: {
          where: { active: true },
          include: {
            services: {
              select: { serviceId: true },
            },
          },
        },
      },
    });
  }

  if (!salon) {
    notFound();
  }

  // Format data for the client wizard
  const formattedSalon = {
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    phone: salon.phone,
    email: salon.email,
    addressLine: salon.addressLine,
    city: salon.city,
    timezone: salon.timezone,
  };

  const formattedServices = salon.services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    priceCents: s.priceCents,
  }));

  const formattedStaff = salon.staff.map((st) => ({
    id: st.id,
    name: st.name,
    title: st.title,
    serviceIds: st.services.map((svc) => svc.serviceId),
  }));

  return (
    <>
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Online Booking</p>
          <h1 className="mt-1 font-display text-4xl text-white tracking-tight">{salon.name}</h1>
          {(salon.addressLine || salon.city) && (
            <p className="mt-1 text-xs text-muted">
              📍 {[salon.addressLine, salon.city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <Link
          href="/dashboard"
          className="text-xs text-muted hover:text-white underline transition"
        >
          Owner dashboard →
        </Link>
      </div>

      {formattedServices.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-12 text-center">
          <p className="font-display text-xl text-white">Service Menu Under Construction</p>
          <p className="mt-2 text-sm text-muted">
            This salon has not added active services to their booking menu yet.
          </p>
        </div>
      ) : (
        <BookingWizard
          salon={formattedSalon}
          services={formattedServices}
          staff={formattedStaff}
        />
      )}
    </>
  );
}

export default function BookingPage({ params }: PageProps) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <Suspense
          fallback={
            <div className="py-24 text-center text-muted animate-pulse">
              Loading salon booking experience...
            </div>
          }
        >
          <BookingContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}
