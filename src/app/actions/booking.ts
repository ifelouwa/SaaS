"use server";

import { getPrisma } from "@/lib/prisma";
import {
  sendCustomerBookingConfirmation,
  sendOwnerNewBookingAlert,
  type BookingNotificationPayload,
} from "@/lib/notifications";

export type CreateAppointmentInput = {
  salonSlug: string;
  serviceId: string;
  staffId: string;
  startsAt: string; // ISO string
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
};

export type AppointmentConfirmation = {
  id: string;
  salonName: string;
  salonSlug: string;
  serviceName: string;
  serviceDuration: number;
  servicePriceCents: number;
  staffName: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
};

export type CreateAppointmentResult = {
  error?: string;
  success?: boolean;
  appointment?: AppointmentConfirmation;
};

export async function createAppointmentAction(
  data: CreateAppointmentInput
): Promise<CreateAppointmentResult> {
  const {
    salonSlug,
    serviceId,
    staffId,
    startsAt,
    customerName,
    customerEmail,
    customerPhone,
    notes,
  } = data;

  if (!customerName || !customerEmail || !startsAt || !serviceId || !staffId) {
    return { error: "Please complete all required fields." };
  }

  const prisma = getPrisma();

  try {
    const salon = await prisma.salon.findUnique({
      where: { slug: salonSlug },
      include: {
        owner: { select: { email: true } },
      },
    });
    if (!salon) {
      return { error: "Salon not found." };
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, salonId: salon.id, active: true },
    });
    if (!service) {
      return { error: "Service not found or is currently inactive." };
    }

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, salonId: salon.id, active: true },
    });
    if (!staff) {
      return { error: "Stylist not found or is currently inactive." };
    }

    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(startsAtDate.getTime() + service.durationMinutes * 60 * 1000);

    // Race-condition guard: check if stylist already has a conflicting appointment
    const conflict = await prisma.appointment.findFirst({
      where: {
        staffId: staff.id,
        status: { not: "CANCELLED" },
        startsAt: { lt: endsAtDate },
        endsAt: { gt: startsAtDate },
      },
    });

    if (conflict) {
      return {
        error: "This time slot was just booked by another customer. Please select another slot.",
      };
    }

    // Upsert client record by salonId + customerEmail
    const normalizedEmail = customerEmail.toLowerCase().trim();
    let clientId: string | undefined = undefined;

    if (normalizedEmail) {
      const client = await prisma.client.upsert({
        where: {
          salonId_email: {
            salonId: salon.id,
            email: normalizedEmail,
          },
        },
        update: {
          name: customerName.trim(),
          phone: customerPhone?.trim() || undefined,
        },
        create: {
          salonId: salon.id,
          name: customerName.trim(),
          email: normalizedEmail,
          phone: customerPhone?.trim() || null,
        },
      });
      clientId = client.id;
    }

    // Create confirmed appointment
    const appt = await prisma.appointment.create({
      data: {
        salonId: salon.id,
        staffId: staff.id,
        serviceId: service.id,
        clientId,
        customerName: customerName.trim(),
        customerEmail: normalizedEmail,
        customerPhone: customerPhone?.trim() || null,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        status: "CONFIRMED",
        notes: notes?.trim() || null,
      },
      include: {
        service: true,
        staff: true,
        salon: true,
      },
    });

    // Trigger automated booking notifications asynchronously
    const notificationPayload: BookingNotificationPayload = {
      appointmentId: appt.id,
      salonName: appt.salon.name,
      salonSlug: appt.salon.slug,
      salonEmail: appt.salon.email,
      salonPhone: appt.salon.phone,
      salonAddress: appt.salon.addressLine,
      ownerEmail: salon.owner?.email || null,
      customerName: appt.customerName,
      customerEmail: appt.customerEmail || normalizedEmail,
      customerPhone: appt.customerPhone,
      serviceName: appt.service.name,
      serviceDuration: appt.service.durationMinutes,
      servicePriceCents: appt.service.priceCents,
      staffName: appt.staff.name,
      startsAt: appt.startsAt,
      endsAt: appt.endsAt,
    };

    // Send customer confirmation + ICS and owner alert
    Promise.allSettled([
      sendCustomerBookingConfirmation(notificationPayload),
      sendOwnerNewBookingAlert(notificationPayload),
    ]).catch((err) => console.error("Notification dispatch error:", err));

    return {
      success: true,
      appointment: {
        id: appt.id,
        salonName: appt.salon.name,
        salonSlug: appt.salon.slug,
        serviceName: appt.service.name,
        serviceDuration: appt.service.durationMinutes,
        servicePriceCents: appt.service.priceCents,
        staffName: appt.staff.name,
        startsAt: appt.startsAt.toISOString(),
        endsAt: appt.endsAt.toISOString(),
        customerName: appt.customerName,
        customerEmail: appt.customerEmail,
        customerPhone: appt.customerPhone,
        status: appt.status,
      },
    };
  } catch (err: unknown) {
    console.error("Create appointment error:", err);
    return {
      error: "An unexpected error occurred while booking. Please try again.",
    };
  }
}

/**
 * Seeds demo salon data (services, staff, split shift schedules, salon hours)
 * so that /book/demo-salon or any empty salon has rich testable bookings immediately.
 */
export async function seedDemoSalonAction(targetSlug: string = "demo-salon") {
  const prisma = getPrisma();

  // Find or create demo owner
  let owner = await prisma.user.findFirst({
    where: { email: "owner@demo-salon.com" },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: "Claire Montclaire",
        email: "owner@demo-salon.com",
      },
    });
  }

  // Find or create salon
  let salon = await prisma.salon.findUnique({
    where: { slug: targetSlug },
  });

  if (!salon) {
    salon = await prisma.salon.create({
      data: {
        name: "Maison Atelier Salon",
        slug: targetSlug,
        ownerId: owner.id,
        phone: "(212) 555-0199",
        email: "hello@maisonatelier.com",
        addressLine: "450 West Broadway",
        city: "New York, NY",
        timezone: "America/New_York",
        subscription: {
          create: {
            plan: "GROWTH",
            status: "ACTIVE",
          },
        },
      },
    });
  }

  // Ensure salon hours (Monday=1 through Saturday=6 open, Sunday=0 closed)
  const existingHours = await prisma.salonHour.count({ where: { salonId: salon.id } });
  if (existingHours === 0) {
    const hours = [
      { dayOfWeek: 0, closed: true, startMinute: 540, endMinute: 1080 }, // Sun Closed
      { dayOfWeek: 1, closed: false, startMinute: 540, endMinute: 1080 }, // Mon 9am - 6pm
      { dayOfWeek: 2, closed: false, startMinute: 540, endMinute: 1080 }, // Tue 9am - 6pm
      { dayOfWeek: 3, closed: false, startMinute: 540, endMinute: 1080 }, // Wed 9am - 6pm
      { dayOfWeek: 4, closed: false, startMinute: 540, endMinute: 1080 }, // Thu 9am - 6pm
      { dayOfWeek: 5, closed: false, startMinute: 540, endMinute: 1080 }, // Fri 9am - 6pm
      { dayOfWeek: 6, closed: false, startMinute: 540, endMinute: 1080 }, // Sat 9am - 6pm
    ];
    for (const h of hours) {
      await prisma.salonHour.create({
        data: {
          salonId: salon.id,
          dayOfWeek: h.dayOfWeek,
          closed: h.closed,
          startMinute: h.startMinute,
          endMinute: h.endMinute,
        },
      });
    }
  }

  // Seed sample services if none exist
  const existingServices = await prisma.service.findMany({ where: { salonId: salon.id } });
  let services = existingServices;

  if (existingServices.length === 0) {
    const serviceData = [
      {
        name: "Signature Haircut & Blowout",
        description: "Custom consultation, wash, tailored scissor & razor cut, with luxury blowout.",
        durationMinutes: 45,
        priceCents: 6500,
      },
      {
        name: "Balayage & Dimensional Color",
        description: "Hand-painted dimensional highlights finished with gloss toning and bond repair treatment.",
        durationMinutes: 120,
        priceCents: 18500,
      },
      {
        name: "Botanical Scalp & Hair Treatment",
        description: "Deep restorative organic scalp massage, nourishing mask, and steam therapy.",
        durationMinutes: 30,
        priceCents: 4500,
      },
      {
        name: "Express Blowout & Style",
        description: "Cleansing wash followed by professional round-brush volume blowout and finishing.",
        durationMinutes: 30,
        priceCents: 4000,
      },
    ];

    services = [];
    for (const s of serviceData) {
      const created = await prisma.service.create({
        data: {
          salonId: salon.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          priceCents: s.priceCents,
          active: true,
        },
      });
      services.push(created);
    }
  }

  // Seed sample staff with split shifts if none exist
  const existingStaff = await prisma.staff.findMany({ where: { salonId: salon.id } });
  if (existingStaff.length === 0) {
    const staffData = [
      {
        name: "Elena Vance",
        title: "Creative Director & Master Stylist",
        email: "elena@maisonatelier.com",
        // Elena works Mon-Fri: Morning shift 9:00 - 13:00, Afternoon shift 14:00 - 18:00 (Split Shift)
        schedules: [1, 2, 3, 4, 5].flatMap((day) => [
          { dayOfWeek: day, startMinute: 540, endMinute: 780 }, // 9am - 1pm
          { dayOfWeek: day, startMinute: 840, endMinute: 1080 }, // 2pm - 6pm (1hr lunch split)
        ]),
        serviceIndices: [0, 1, 2, 3], // Can do all services
      },
      {
        name: "Marcus Thorne",
        title: "Senior Color Specialist",
        email: "marcus@maisonatelier.com",
        // Marcus works Tue-Sat: 10:00 - 18:00
        schedules: [2, 3, 4, 5, 6].map((day) => ({
          dayOfWeek: day,
          startMinute: 600, // 10am
          endMinute: 1080, // 6pm
        })),
        serviceIndices: [0, 1, 2], // Haircut, Balayage, Treatment
      },
      {
        name: "Chloe Bennett",
        title: "Stylist & Blowout Artist",
        email: "chloe@maisonatelier.com",
        // Chloe works Mon, Wed, Fri, Sat: 9:00 - 17:00
        schedules: [1, 3, 5, 6].map((day) => ({
          dayOfWeek: day,
          startMinute: 540, // 9am
          endMinute: 1020, // 5pm
        })),
        serviceIndices: [0, 2, 3], // Haircut, Treatment, Blowout
      },
    ];

    for (const member of staffData) {
      const createdStaff = await prisma.staff.create({
        data: {
          salonId: salon.id,
          name: member.name,
          title: member.title,
          email: member.email,
          active: true,
          schedules: {
            create: member.schedules,
          },
        },
      });

      // Link staff to their services
      for (const idx of member.serviceIndices) {
        if (services[idx]) {
          await prisma.staffService.create({
            data: {
              staffId: createdStaff.id,
              serviceId: services[idx].id,
            },
          });
        }
      }
    }
  }

  return { success: true, salonSlug: salon.slug };
}
