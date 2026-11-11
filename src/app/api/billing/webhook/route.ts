import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, mapStripeStatusToPrisma } from "@/lib/stripe";
import { getPrisma } from "@/lib/prisma";
import { Plan } from "@/generated/prisma/enums";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // In development if no webhook secret is set yet, parse event body
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: unknown) {
    console.error("Webhook signature verification failed:", err);
    const message = err instanceof Error ? err.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const prisma = getPrisma();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const salonId = session.metadata?.salonId;
        const plan = (session.metadata?.plan as Plan) || "STARTER";
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (salonId) {
          await prisma.subscription.upsert({
            where: { salonId },
            update: {
              stripeCustomerId: customerId || undefined,
              stripeSubscriptionId: subscriptionId || undefined,
              plan,
              status: "ACTIVE",
              trialEndsAt: null,
            },
            create: {
              salonId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan,
              status: "ACTIVE",
            },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const salonId = sub.metadata?.salonId;
        const plan = sub.metadata?.plan as Plan | undefined;
        const mappedStatus = mapStripeStatusToPrisma(sub.status);
        const priceId = sub.items.data[0]?.price?.id;

        // Find existing record by stripeSubscriptionId, stripeCustomerId, or metadata salonId
        const existing = await prisma.subscription.findFirst({
          where: {
            OR: [
              { stripeSubscriptionId: sub.id },
              { stripeCustomerId: customerId },
              ...(salonId ? [{ salonId }] : []),
            ],
          },
        });

        if (existing) {
          // Read current period end timestamp
          const currentPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
            ? new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000)
            : null;

          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: mappedStatus,
              stripeSubscriptionId: sub.id,
              stripeCustomerId: customerId,
              stripePriceId: priceId || existing.stripePriceId,
              plan: plan || existing.plan,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              currentPeriodEnd: currentPeriodEnd || existing.currentPeriodEnd,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const existing = await prisma.subscription.findFirst({
          where: {
            OR: [
              { stripeSubscriptionId: sub.id },
              { stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id },
            ],
          },
        });

        if (existing) {
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: "CANCELED",
              cancelAtPeriodEnd: false,
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

        if (customerId) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
          });
          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: "PAST_DUE" },
            });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

        if (customerId) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
          });
          if (sub && sub.status !== "ACTIVE") {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: "ACTIVE" },
            });
          }
        }
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("Error processing Stripe webhook:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}
