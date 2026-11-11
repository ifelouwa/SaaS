import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";

export type AuthenticatedOwnerData = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  salon: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    phone: string | null;
    email: string | null;
    subscription: {
      id: string;
      plan: "STARTER" | "GROWTH";
      status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE";
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      trialEndsAt: Date | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
    } | null;
    _count: {
      staff: number;
      services: number;
      appointments: number;
    };
  } | null;
};

/**
 * Retrieves the current session and links it to the owner's salon record (Salon.ownerId).
 */
export async function getAuthenticatedOwner(): Promise<AuthenticatedOwnerData | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return null;
  }

  const prisma = getPrisma();
  const salon = await prisma.salon.findFirst({
    where: {
      ownerId: session.user.id,
    },
    include: {
      subscription: true,
      _count: {
        select: {
          staff: true,
          services: true,
          appointments: true,
        },
      },
    },
  });

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || "Salon Owner",
    },
    salon,
  };
}

/**
 * Server guard: Ensures user is signed in as a salon owner.
 * Redirects to /login if unauthenticated.
 */
export async function requireAuthOwner(): Promise<NonNullable<AuthenticatedOwnerData>> {
  const data = await getAuthenticatedOwner();
  if (!data) {
    redirect("/login");
  }
  return data;
}

/**
 * Server guard: Ensures the salon owner has an active or trialing subscription.
 * Redirects to /dashboard/billing if the subscription is missing, expired, past_due, or canceled.
 */
export async function requireActiveSubscription(): Promise<NonNullable<AuthenticatedOwnerData>> {
  const data = await requireAuthOwner();

  if (!data.salon) {
    // Owner hasn't completed salon onboarding
    redirect("/dashboard/billing?reason=no_salon");
  }

  const sub = data.salon.subscription;
  if (!sub) {
    redirect("/dashboard/billing?reason=missing");
  }

  const isTrialExpired =
    sub.status === "TRIALING" && sub.trialEndsAt && new Date() > new Date(sub.trialEndsAt);

  const isActive = sub.status === "ACTIVE" || (sub.status === "TRIALING" && !isTrialExpired);

  if (!isActive) {
    const reason = isTrialExpired ? "trial_expired" : sub.status.toLowerCase();
    redirect(`/dashboard/billing?reason=${reason}`);
  }

  return data;
}

/**
 * Multi-tenant guard: Verifies that a salon ID belongs to the current authenticated owner.
 */
export async function assertSalonOwnership(salonId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const prisma = getPrisma();
  const salon = await prisma.salon.findFirst({
    where: {
      id: salonId,
      ownerId: session.user.id,
    },
    select: { id: true },
  });

  return Boolean(salon);
}
