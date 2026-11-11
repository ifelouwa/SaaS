import { getPrisma } from "@/lib/prisma";
import {
  formatMinuteToDisplay,
  formatMinuteTo24Hour,
  timeStringToMinute,
  getDayOfWeekFromDateString,
} from "@/lib/date-utils";

export {
  formatMinuteToDisplay,
  formatMinuteTo24Hour,
  timeStringToMinute,
  getDayOfWeekFromDateString,
};

export type AvailableSlot = {
  startMinute: number;
  endMinute: number;
  time: string; // e.g. "09:00"
  displayTime: string; // e.g. "9:00 AM"
  displayEndTime: string; // e.g. "9:45 AM"
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  availableStaff: {
    id: string;
    name: string;
    title: string | null;
  }[];
};

export type AvailabilityResponse = {
  date: string;
  dayOfWeek: number;
  salon: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  };
  isOpen: boolean;
  reason?: string;
  slots: AvailableSlot[];
};



/**
 * Core booking availability algorithm.
 * Intersects salon operating hours, staff schedules, and existing appointments to yield free booking slots.
 */
export async function computeAvailability(params: {
  salonSlug: string;
  dateStr: string; // "YYYY-MM-DD"
  serviceId: string;
  staffId?: string; // Optional: specific stylist, or undefined/"any"
}): Promise<AvailabilityResponse> {
  const prisma = getPrisma();
  const { salonSlug, dateStr, serviceId, staffId } = params;

  // 1. Fetch salon with hours
  const salon = await prisma.salon.findUnique({
    where: { slug: salonSlug },
    include: {
      hours: true,
    },
  });

  if (!salon) {
    throw new Error(`Salon '${salonSlug}' not found.`);
  }

  // 2. Fetch service
  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      salonId: salon.id,
      active: true,
    },
  });

  if (!service) {
    throw new Error("Service not found or is currently inactive.");
  }

  const { dayOfWeek, year, month, day } = getDayOfWeekFromDateString(dateStr);

  // 3. Check SalonHour for this weekday
  const salonHour = salon.hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!salonHour || salonHour.closed) {
    return {
      date: dateStr,
      dayOfWeek,
      salon: {
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        timezone: salon.timezone,
      },
      service: {
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
      },
      isOpen: false,
      reason: "Salon is closed on this day.",
      slots: [],
    };
  }

  // 4. Filter stylists assigned to the selected serviceId via StaffService
  const staffFilter: {
    salonId: string;
    active: true;
    services: { some: { serviceId: string } };
    id?: string;
  } = {
    salonId: salon.id,
    active: true,
    services: {
      some: {
        serviceId: service.id,
      },
    },
  };

  if (staffId && staffId !== "any") {
    staffFilter.id = staffId;
  }

  // Range of the date in UTC
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

  const eligibleStaff = await prisma.staff.findMany({
    where: staffFilter,
    include: {
      schedules: {
        where: {
          dayOfWeek,
        },
      },
      appointments: {
        where: {
          startsAt: { lte: endOfDay },
          endsAt: { gte: startOfDay },
          status: { not: "CANCELLED" },
        },
      },
    },
  });

  if (eligibleStaff.length === 0) {
    return {
      date: dateStr,
      dayOfWeek,
      salon: {
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        timezone: salon.timezone,
      },
      service: {
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
      },
      isOpen: true,
      reason: "No stylists offering this service are scheduled today.",
      slots: [],
    };
  }

  // Step interval for potential slot starts (15-minute standard grid)
  const slotIntervalMinutes = 15;
  const duration = service.durationMinutes;

  // Map to collect slots: minuteOfDay -> list of available staff
  const slotsMap = new Map<
    number,
    {
      staff: { id: string; name: string; title: string | null }[];
      startsAt: Date;
      endsAt: Date;
    }
  >();

  // 5. Intersect each stylist's schedule with salon hours and check appointments
  for (const stylist of eligibleStaff) {
    for (const shift of stylist.schedules) {
      // Overlap of salon opening hours and staff schedule
      const windowStart = Math.max(salonHour.startMinute, shift.startMinute);
      const windowEnd = Math.min(salonHour.endMinute, shift.endMinute);

      for (let m = windowStart; m + duration <= windowEnd; m += slotIntervalMinutes) {
        const slotStart = new Date(
          Date.UTC(year, month - 1, day, Math.floor(m / 60), m % 60, 0)
        );
        const slotEnd = new Date(
          Date.UTC(
            year,
            month - 1,
            day,
            Math.floor((m + duration) / 60),
            (m + duration) % 60,
            0
          )
        );

        // Check if stylist has an overlapping booked appointment
        const hasConflict = stylist.appointments.some((appt) => {
          return appt.startsAt < slotEnd && appt.endsAt > slotStart;
        });

        if (!hasConflict) {
          if (!slotsMap.has(m)) {
            slotsMap.set(m, {
              staff: [],
              startsAt: slotStart,
              endsAt: slotEnd,
            });
          }
          slotsMap.get(m)!.staff.push({
            id: stylist.id,
            name: stylist.name,
            title: stylist.title,
          });
        }
      }
    }
  }

  // 6. Convert sorted map to slots array
  const sortedMinutes = Array.from(slotsMap.keys()).sort((a, b) => a - b);

  const slots: AvailableSlot[] = sortedMinutes.map((minute) => {
    const entry = slotsMap.get(minute)!;
    return {
      startMinute: minute,
      endMinute: minute + duration,
      time: formatMinuteTo24Hour(minute),
      displayTime: formatMinuteToDisplay(minute),
      displayEndTime: formatMinuteToDisplay(minute + duration),
      startsAt: entry.startsAt.toISOString(),
      endsAt: entry.endsAt.toISOString(),
      availableStaff: entry.staff,
    };
  });

  return {
    date: dateStr,
    dayOfWeek,
    salon: {
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      timezone: salon.timezone,
    },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
    },
    isOpen: true,
    slots,
  };
}
