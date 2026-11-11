import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth-helpers";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { plans } from "@/lib/plans";
import { getPrisma } from "@/lib/prisma";
import { Plan } from "@/generated/prisma/enums";

export async function POST(request: Request) {
  try {
    const ownerData = await getAuthenticatedOwner();
    if (!ownerData || !ownerData.salon) {
      return NextResponse.json({ error: "Unauthorized. Please sign in as a salon owner." }, { status: 401 });
    }

    const { salon, user } = ownerData;
    const body = await request.json().catch(() => ({}));
    const requestedPlan: Plan = body.plan === "GROWTH" ? "GROWTH" : "STARTER";
    const planConfig = plans.find((p) => p.id === requestedPlan) || plans[0];

    // If Stripe is not configured with keys in environment, return graceful simulation guidance
    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          error: "STRIPE_SECRET_KEY is not configured in .env. Please set Stripe API keys or use the built-in simulator.",
          isSimulated: true,
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const prisma = getPrisma();
    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Retrieve or create Stripe customer
    let stripeCustomerId = salon.subscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          salonId: salon.id,
          salonSlug: salon.slug,
          ownerId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Persist customer ID to subscription
      await prisma.subscription.upsert({
        where: { salonId: salon.id },
        update: { stripeCustomerId },
        create: {
          salonId: salon.id,
          plan: requestedPlan,
          status: "TRIALING",
          stripeCustomerId,
        },
      });
    }

    // Determine price configuration: use env price ID or inline price_data
    const envPriceId =
      requestedPlan === "GROWTH"
        ? process.env.STRIPE_PRICE_GROWTH
        : process.env.STRIPE_PRICE_STARTER;

    const lineItems = envPriceId
      ? [{ price: envPriceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Atelier ${planConfig.name} Plan`,
                description: planConfig.summary,
              },
              unit_amount: planConfig.priceMonthlyCents,
              recurring: {
                interval: "month" as const,
              },
            },
            quantity: 1,
          },
        ];

    // Create Checkout Session in subscription mode
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: lineItems,
      subscription_data: {
        metadata: {
          salonId: salon.id,
          ownerId: user.id,
          plan: requestedPlan,
        },
      },
      metadata: {
        salonId: salon.id,
        ownerId: user.id,
        plan: requestedPlan,
      },
      success_url: `${origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/dashboard/billing?canceled=true`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: unknown) {
    console.error("Stripe Checkout error:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
