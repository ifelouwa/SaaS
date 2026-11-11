"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { requireActiveSubscription, assertSalonOwnership } from "@/lib/auth-helpers";
import { plans } from "@/lib/plans";

export type StaffActionResult = {
  error?: string;
  success?: boolean;
  upgradeRequired?: boolean;
};

export type CreateStaffInput = {
  name: string;
  title?: string;
  email?: string;
};

export type UpdateStaffInput = {
  name?: string;
  title?: string;
  email?: string;
  active?: boolean;
};

export type ScheduleBlock = {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  startMinute: number;
  endMinute: number;
};

// ---------------------------------------------------------------------------
// createStaffMemberAction
// ---------------------------------------------------------------------------
export async function createStaffMemberAction(
  input: CreateStaffInput
): Promise<StaffActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  const { name, title, email } = input;
  if (!name?.trim()) return { error: "Name is required." };

  const prisma = getPrisma();

  // Enforce plan staff limit
  const plan = plans.find((p) => p.id === salon.subscription?.plan);
  const staffLimit = plan?.staffLimit ?? null;

  if (staffLimit !== null) {
    const activeCount = await prisma.staff.count({
      where: { salonId: salon.id, active: true },
    });
    if (activeCount >= staffLimit) {
      return {
        error: `Your ${plan?.name} plan allows up to ${staffLimit} active stylists. Upgrade to Growth for unlimited staff.`,
        upgradeRequired: true,
      };
    }
  }

  try {
    await prisma.staff.create({
      data: {
        salonId: salon.id,
        name: name.trim(),
        title: title?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        active: true,
      },
    });

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to create staff member:", err);
    return { error: "Failed to add stylist. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// updateStaffMemberAction
// ---------------------------------------------------------------------------
export async function updateStaffMemberAction(
  staffId: string,
  input: UpdateStaffInput
): Promise<StaffActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  const prisma = getPrisma();

  const existing = await prisma.staff.findFirst({
    where: { id: staffId, salonId: salon.id },
  });
  if (!existing) return { error: "Stylist not found." };

  // If activating, re-check plan limit
  if (input.active === true && !existing.active) {
    const plan = plans.find((p) => p.id === salon.subscription?.plan);
    const staffLimit = plan?.staffLimit ?? null;
    if (staffLimit !== null) {
      const activeCount = await prisma.staff.count({
        where: { salonId: salon.id, active: true },
      });
      if (activeCount >= staffLimit) {
        return {
          error: `Your ${plan?.name} plan allows up to ${staffLimit} active stylists. Upgrade to Growth for unlimited staff.`,
          upgradeRequired: true,
        };
      }
    }
  }

  try {
    await prisma.staff.update({
      where: { id: staffId },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.title !== undefined && { title: input.title.trim() || null }),
        ...(input.email !== undefined && {
          email: input.email.trim().toLowerCase() || null,
        }),
        ...(input.active !== undefined && { active: input.active }),
      },
    });

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to update staff member:", err);
    return { error: "Failed to update stylist. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// toggleStaffActiveAction  (soft-delete toggle)
// ---------------------------------------------------------------------------
export async function toggleStaffActiveAction(
  staffId: string,
  active: boolean
): Promise<StaffActionResult> {
  return updateStaffMemberAction(staffId, { active });
}

// ---------------------------------------------------------------------------
// updateStaffScheduleAction
// Replaces ALL StaffSchedule rows for a staff member with the new blocks.
// Supports split shifts: multiple blocks per dayOfWeek are allowed.
// ---------------------------------------------------------------------------
export async function updateStaffScheduleAction(
  staffId: string,
  blocks: ScheduleBlock[]
): Promise<StaffActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  const prisma = getPrisma();

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, salonId: salon.id },
  });
  if (!staff) return { error: "Stylist not found." };

  // Enforce split-shifts restriction on Starter plan
  const plan = plans.find((p) => p.id === salon.subscription?.plan);
  const allowSplitShifts = plan?.allowSplitShifts ?? false;

  if (!allowSplitShifts) {
    // Count blocks per dayOfWeek
    const dayCounts: Record<number, number> = {};
    for (const b of blocks) {
      dayCounts[b.dayOfWeek] = (dayCounts[b.dayOfWeek] || 0) + 1;
      if (dayCounts[b.dayOfWeek] > 1) {
        return {
          error: "Split shifts (multiple blocks per day) require the Growth Plan. Please upgrade to unlock.",
          upgradeRequired: true,
        };
      }
    }
  }

  // Basic validation
  for (const block of blocks) {
    if (block.startMinute >= block.endMinute) {
      return { error: "Each shift block must have a start time before the end time." };
    }
    if (block.dayOfWeek < 0 || block.dayOfWeek > 6) {
      return { error: "Invalid day of week." };
    }
  }

  try {
    await prisma.$transaction([
      prisma.staffSchedule.deleteMany({ where: { staffId } }),
      ...(blocks.length > 0
        ? [
            prisma.staffSchedule.createMany({
              data: blocks.map((b) => ({
                staffId,
                dayOfWeek: b.dayOfWeek,
                startMinute: b.startMinute,
                endMinute: b.endMinute,
              })),
            }),
          ]
        : []),
    ]);

    revalidatePath("/dashboard/staff");
    revalidatePath(`/api/salons/${salon.slug}/availability`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to update staff schedule:", err);
    return { error: "Failed to save schedule. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// updateStaffServicesAction
// Syncs the StaffService join table so the staff member offers exactly the
// given set of services.
// ---------------------------------------------------------------------------
export async function updateStaffServicesAction(
  staffId: string,
  serviceIds: string[]
): Promise<StaffActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  const prisma = getPrisma();

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, salonId: salon.id },
  });
  if (!staff) return { error: "Stylist not found." };

  // Verify all serviceIds belong to this salon
  if (serviceIds.length > 0) {
    const valid = await prisma.service.count({
      where: { id: { in: serviceIds }, salonId: salon.id },
    });
    if (valid !== serviceIds.length) {
      return { error: "One or more services are invalid." };
    }
  }

  try {
    await prisma.$transaction([
      prisma.staffService.deleteMany({ where: { staffId } }),
      ...(serviceIds.length > 0
        ? [
            prisma.staffService.createMany({
              data: serviceIds.map((sid) => ({ staffId, serviceId: sid })),
            }),
          ]
        : []),
    ]);

    revalidatePath("/dashboard/staff");
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to update staff services:", err);
    return { error: "Failed to save service assignments. Please try again." };
  }
}
