"use server";

import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { Plan, SubscriptionStatus } from "@/generated/prisma/enums";

export type AuthActionResult = {
  error?: string;
  success?: boolean;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function registerOwnerAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const salonName = formData.get("salonName")?.toString().trim();
  const requestedSlug = formData.get("slug")?.toString().trim();
  const plan = (formData.get("plan")?.toString() as Plan) || "STARTER";

  if (!name || !email || !password || !salonName) {
    return { error: "Please fill out all required fields." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters long." };
  }

  const slug = requestedSlug ? slugify(requestedSlug) : slugify(salonName);
  if (!slug) {
    return { error: "Please provide a valid salon slug." };
  }

  const prisma = getPrisma();

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return { error: "An account with this email already exists." };
    }

    // Check if salon slug is taken
    const existingSalon = await prisma.salon.findUnique({
      where: { slug },
    });
    if (existingSalon) {
      return { error: `The URL slug '/book/${slug}' is already taken. Try another name.` };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day free trial

    // Atomically create User, Salon, Subscription, and initial SalonHours
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
      });

      const salon = await tx.salon.create({
        data: {
          name: salonName,
          slug,
          ownerId: user.id,
          subscription: {
            create: {
              plan,
              status: "TRIALING",
              trialEndsAt,
            },
          },
        },
      });

      // Populate default salon operating hours (Monday=1 through Saturday=6 open 9:00 - 18:00; Sunday=0 closed)
      const defaultHours = [
        { dayOfWeek: 0, closed: true, startMinute: 540, endMinute: 1080 }, // Sunday closed
        { dayOfWeek: 1, closed: false, startMinute: 540, endMinute: 1080 }, // Monday 9am - 6pm
        { dayOfWeek: 2, closed: false, startMinute: 540, endMinute: 1080 }, // Tuesday 9am - 6pm
        { dayOfWeek: 3, closed: false, startMinute: 540, endMinute: 1080 }, // Wednesday 9am - 6pm
        { dayOfWeek: 4, closed: false, startMinute: 540, endMinute: 1080 }, // Thursday 9am - 6pm
        { dayOfWeek: 5, closed: false, startMinute: 540, endMinute: 1080 }, // Friday 9am - 6pm
        { dayOfWeek: 6, closed: false, startMinute: 540, endMinute: 1080 }, // Saturday 9am - 6pm
      ];

      for (const hour of defaultHours) {
        await tx.salonHour.create({
          data: {
            salonId: salon.id,
            dayOfWeek: hour.dayOfWeek,
            closed: hour.closed,
            startMinute: hour.startMinute,
            endMinute: hour.endMinute,
          },
        });
      }
    });

    // Auto sign in after registration
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });

    return { success: true };
  } catch (err: unknown) {
    // Next.js redirect throws a special internal error - let it bubble up
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: string }).digest).includes("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("Registration error:", err);
    return { error: "An unexpected error occurred during registration. Please try again." };
  }
}

export async function loginOwnerAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });

    return { success: true };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: string }).digest).includes("NEXT_REDIRECT")) {
      throw err;
    }
    return { error: "Invalid email or password. Please verify your credentials." };
  }
}

export async function signOutOwnerAction() {
  await signOut({ redirectTo: "/login" });
}

export async function simulateSubscriptionStatusAction(salonId: string, status: SubscriptionStatus) {
  const prisma = getPrisma();
  await prisma.subscription.upsert({
    where: { salonId },
    update: {
      status,
      trialEndsAt: status === "TRIALING" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
    },
    create: {
      salonId,
      status,
      plan: "STARTER",
    },
  });
}
