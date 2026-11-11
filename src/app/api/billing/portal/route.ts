import { NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth-helpers";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const ownerData = await getAuthenticatedOwner();
    if (!ownerData || !ownerData.salon) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured in environment variables." },
        { status: 400 }
      );
    }

    const { salon } = ownerData;
    const stripeCustomerId = salon.subscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No active Stripe customer profile found. Please start a subscription first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/dashboard/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: unknown) {
    console.error("Stripe Portal error:", error);
    const message = error instanceof Error ? error.message : "Failed to open billing portal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
