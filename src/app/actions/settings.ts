"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { requireActiveSubscription, assertSalonOwnership } from "@/lib/auth-helpers";

export type SettingsActionResult = {
  error?: string;
  success?: boolean;
};

export type UpdateSalonProfileInput = {
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  timezone: string;
};

export type SalonHourInput = {
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  closed: boolean;
  startMinute: number;
  endMinute: number;
};

// ---------------------------------------------------------------------------
// updateSalonProfileAction
// ---------------------------------------------------------------------------
export async function updateSalonProfileAction(
  input: UpdateSalonProfileInput
): Promise<SettingsActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  const { name, slug, phone, email, addressLine, city, timezone } = input;

  if (!name?.trim()) return { error: "Salon name is required." };
  if (!slug?.trim()) return { error: "Public booking slug is required." };

  // Slug formatting: lowercase, alphanumeric and dashes only
  const cleanSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (cleanSlug.length < 3) {
    return { error: "Slug must be at least 3 characters long (letters, numbers, hyphens)." };
  }

  const prisma = getPrisma();

  // Slug uniqueness check
  const existingWithSlug = await prisma.salon.findFirst({
    where: {
      slug: cleanSlug,
      id: { not: salon.id },
    },
  });

  if (existingWithSlug) {
    return { error: `The booking link slug "${cleanSlug}" is already taken by another salon.` };
  }

  try {
    await prisma.salon.update({
      where: { id: salon.id },
      data: {
        name: name.trim(),
        slug: cleanSlug,
        phone: phone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        addressLine: addressLine?.trim() || null,
        city: city?.trim() || null,
        timezone: timezone?.trim() || "America/New_York",
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath(`/book/${cleanSlug}`);
    revalidatePath(`/book/${salon.slug}`);
    revalidatePath(`/api/salons/${cleanSlug}/availability`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to update salon profile:", err);
    return { error: "Failed to update salon profile. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// updateSalonHoursAction
// ---------------------------------------------------------------------------
export async function updateSalonHoursAction(
  hours: SalonHourInput[]
): Promise<SettingsActionResult> {
  const { salon } = await requireActiveSubscription();
  if (!salon) return { error: "Unauthorized." };

  const isOwner = await assertSalonOwnership(salon.id);
  if (!isOwner) return { error: "Unauthorized." };

  for (const h of hours) {
    if (h.dayOfWeek < 0 || h.dayOfWeek > 6) {
      return { error: "Invalid day of week." };
    }
    if (!h.closed && h.startMinute >= h.endMinute) {
      return { error: "Opening time must be earlier than closing time." };
    }
  }

  const prisma = getPrisma();

  try {
    await prisma.$transaction(
      hours.map((h) =>
        prisma.salonHour.upsert({
          where: {
            salonId_dayOfWeek: {
              salonId: salon.id,
              dayOfWeek: h.dayOfWeek,
            },
          },
          update: {
            closed: h.closed,
            startMinute: h.startMinute,
            endMinute: h.endMinute,
          },
          create: {
            salonId: salon.id,
            dayOfWeek: h.dayOfWeek,
            closed: h.closed,
            startMinute: h.startMinute,
            endMinute: h.endMinute,
          },
        })
      )
    );

    revalidatePath("/dashboard/settings");
    revalidatePath(`/book/${salon.slug}`);
    revalidatePath(`/api/salons/${salon.slug}/availability`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to update salon hours:", err);
    return { error: "Failed to save opening hours." };
  }
}
