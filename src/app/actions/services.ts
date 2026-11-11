"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { requireActiveSubscription, assertSalonOwnership } from "@/lib/auth-helpers";

export type ServiceActionResult = {
  error?: string;
  success?: boolean;
};

export type CreateServiceInput = {
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  staffIds?: string[];
};

export type UpdateServiceInput = {
  name?: string;
  description?: string;
  durationMinutes?: number;
  priceCents?: number;
  active?: boolean;
  staffIds?: string[];
};

// ---------------------------------------------------------------------------
// createServiceAction
// ---------------------------------------------------------------------------
export async function createServiceAction(
  input: CreateServiceInput
): Promise<ServiceActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  const { name, description, durationMinutes, priceCents, staffIds } = input;

  if (!name?.trim()) return { error: "Service name is required." };
  if (!durationMinutes || durationMinutes <= 0) {
    return { error: "Duration must be greater than 0 minutes." };
  }
  if (priceCents === undefined || priceCents < 0) {
    return { error: "Price cannot be negative." };
  }

  const prisma = getPrisma();

  // Check unique name per salon
  const existing = await prisma.service.findFirst({
    where: { salonId: salon.id, name: name.trim() },
  });
  if (existing) {
    return { error: "A service with this name already exists in your salon." };
  }

  try {
    const service = await prisma.service.create({
      data: {
        salonId: salon.id,
        name: name.trim(),
        description: description?.trim() || null,
        durationMinutes,
        priceCents,
        active: true,
      },
    });

    // If staff were assigned, link them
    if (staffIds && staffIds.length > 0) {
      await prisma.staffService.createMany({
        data: staffIds.map((staffId) => ({
          staffId,
          serviceId: service.id,
        })),
        skipDuplicates: true,
      });
    }

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/appointments");
    revalidatePath(`/book/${salon.slug}`);
    revalidatePath(`/api/salons/${salon.slug}/availability`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to create service:", err);
    return { error: "Failed to create service. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// updateServiceAction
// ---------------------------------------------------------------------------
export async function updateServiceAction(
  serviceId: string,
  input: UpdateServiceInput
): Promise<ServiceActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  const prisma = getPrisma();

  const service = await prisma.service.findFirst({
    where: { id: serviceId, salonId: salon.id },
  });
  if (!service) return { error: "Service not found." };

  if (input.name && input.name.trim() !== service.name) {
    const duplicate = await prisma.service.findFirst({
      where: {
        salonId: salon.id,
        name: input.name.trim(),
        id: { not: serviceId },
      },
    });
    if (duplicate) {
      return { error: "Another service already uses this name." };
    }
  }

  if (input.durationMinutes !== undefined && input.durationMinutes <= 0) {
    return { error: "Duration must be greater than 0 minutes." };
  }
  if (input.priceCents !== undefined && input.priceCents < 0) {
    return { error: "Price cannot be negative." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: serviceId },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.description !== undefined && {
            description: input.description.trim() || null,
          }),
          ...(input.durationMinutes !== undefined && {
            durationMinutes: input.durationMinutes,
          }),
          ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
          ...(input.active !== undefined && { active: input.active }),
        },
      });

      if (input.staffIds !== undefined) {
        await tx.staffService.deleteMany({ where: { serviceId } });
        if (input.staffIds.length > 0) {
          await tx.staffService.createMany({
            data: input.staffIds.map((staffId) => ({
              staffId,
              serviceId,
            })),
          });
        }
      }
    });

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/appointments");
    revalidatePath(`/book/${salon.slug}`);
    revalidatePath(`/api/salons/${salon.slug}/availability`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to update service:", err);
    return { error: "Failed to update service. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// toggleServiceActiveAction
// ---------------------------------------------------------------------------
export async function toggleServiceActiveAction(
  serviceId: string,
  active: boolean
): Promise<ServiceActionResult> {
  return updateServiceAction(serviceId, { active });
}

// ---------------------------------------------------------------------------
// deleteServiceAction
// Deletes or soft-archives if appointments exist.
// ---------------------------------------------------------------------------
export async function deleteServiceAction(
  serviceId: string
): Promise<ServiceActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  const prisma = getPrisma();

  const service = await prisma.service.findFirst({
    where: { id: serviceId, salonId: salon.id },
    include: {
      _count: {
        select: { appointments: true },
      },
    },
  });
  if (!service) return { error: "Service not found." };

  try {
    // If appointments reference this service, archive it rather than hard-deleting
    if (service._count.appointments > 0) {
      await prisma.service.update({
        where: { id: serviceId },
        data: { active: false },
      });
      revalidatePath("/dashboard/services");
      revalidatePath("/dashboard/staff");
      revalidatePath(`/book/${salon.slug}`);
      return {
        success: true,
        error: "This service has past bookings, so it was archived instead of permanently deleted.",
      };
    }

    await prisma.service.delete({
      where: { id: serviceId },
    });

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/appointments");
    revalidatePath(`/book/${salon.slug}`);
    revalidatePath(`/api/salons/${salon.slug}/availability`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to delete service:", err);
    return { error: "Failed to delete service." };
  }
}
