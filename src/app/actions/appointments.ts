"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { requireActiveSubscription, assertSalonOwnership } from "@/lib/auth-helpers";
import { AppointmentStatus } from "@/generated/prisma/enums";

export type AppointmentActionResult = {
  error?: string;
  success?: boolean;
};

export async function updateAppointmentStatusAction(
  appointmentId: string,
  newStatus: AppointmentStatus
): Promise<AppointmentActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) {
    return { error: "Unauthorized." };
  }

  const prisma = getPrisma();

  try {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        salonId: salon.id,
      },
    });

    if (!appointment) {
      return { error: "Appointment not found or does not belong to your salon." };
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: newStatus },
    });

    revalidatePath("/dashboard/appointments");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to update appointment status:", err);
    return { error: "Failed to update appointment status." };
  }
}

export type ManualAppointmentInput = {
  serviceId: string;
  staffId: string;
  dateStr: string; // "YYYY-MM-DD"
  timeStr: string; // "HH:MM"
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
};

export async function createManualAppointmentAction(
  input: ManualAppointmentInput
): Promise<AppointmentActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) {
    return { error: "Unauthorized." };
  }

  const {
    serviceId,
    staffId,
    dateStr,
    timeStr,
    customerName,
    customerEmail,
    customerPhone,
    notes,
  } = input;

  if (!serviceId || !staffId || !dateStr || !timeStr || !customerName) {
    return { error: "Please fill out all required fields." };
  }

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) {
    return { error: "Unauthorized." };
  }

  const prisma = getPrisma();

  try {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, salonId: salon.id, active: true },
    });
    if (!service) {
      return { error: "Service not found." };
    }

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, salonId: salon.id, active: true },
    });
    if (!staff) {
      return { error: "Stylist not found." };
    }

    // Construct start and end dates
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const [hourStr, minStr] = timeStr.split(":");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    const hour = parseInt(hourStr, 10);
    const min = parseInt(minStr, 10);

    const startsAt = new Date(Date.UTC(year, month - 1, day, hour, min, 0));
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60 * 1000);

    // Conflict check
    const conflict = await prisma.appointment.findFirst({
      where: {
        staffId: staff.id,
        status: { not: "CANCELLED" },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });

    if (conflict) {
      return {
        error: `Conflict detected: ${staff.name} is already booked between ${conflict.startsAt.toLocaleTimeString()} and ${conflict.endsAt.toLocaleTimeString()}.`,
      };
    }

    let clientId: string | undefined = undefined;
    const normalizedEmail = customerEmail?.trim().toLowerCase();

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

    await prisma.appointment.create({
      data: {
        salonId: salon.id,
        staffId: staff.id,
        serviceId: service.id,
        clientId,
        customerName: customerName.trim(),
        customerEmail: normalizedEmail || null,
        customerPhone: customerPhone?.trim() || null,
        startsAt,
        endsAt,
        status: "CONFIRMED",
        notes: notes?.trim() || null,
      },
    });

    revalidatePath("/dashboard/appointments");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to create manual appointment:", err);
    return { error: "Failed to book appointment. Please check inputs and try again." };
  }
}
