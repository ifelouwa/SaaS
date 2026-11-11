import Stripe from "stripe";
import { SubscriptionStatus } from "@/generated/prisma/enums";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set in environment variables. Please configure it in .env."
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(apiKey, {
      apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion,
      appInfo: {
        name: "Atelier Salon SaaS",
        version: "0.1.0",
      },
    });
  }

  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Maps a Stripe subscription status string to our Prisma SubscriptionStatus enum.
 */
export function mapStripeStatusToPrisma(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return "INCOMPLETE";
  }
}
