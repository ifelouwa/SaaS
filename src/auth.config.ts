import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");
      const isBillingRoute = nextUrl.pathname.startsWith("/dashboard/billing");
      const isAuthRoute = nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

      // Redirect logged-in users away from login/register
      if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      if (isDashboardRoute) {
        if (!isLoggedIn) {
          return false; // Redirects to signIn page (/login)
        }

        // Owners must always be allowed to access the billing page to resolve payment/status issues
        if (isBillingRoute) {
          return true;
        }

        // Subscription Guard:
        // Salon owners with PAST_DUE, CANCELED, or INCOMPLETE subscriptions are redirected to billing
        const status = auth?.user?.subscriptionStatus;
        const isSubscriptionValid = status === "ACTIVE" || status === "TRIALING";

        if (!isSubscriptionValid) {
          const billingUrl = new URL("/dashboard/billing", nextUrl);
          billingUrl.searchParams.set("reason", status ? status.toLowerCase() : "unpaid");
          return Response.redirect(billingUrl);
        }

        return true;
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.salonId = user.salonId;
        token.salonSlug = user.salonSlug;
        token.salonName = user.salonName;
        token.subscriptionStatus = user.subscriptionStatus;
        token.plan = user.plan;
      }
      if (trigger === "update" && session) {
        if (session.salonId !== undefined) token.salonId = session.salonId;
        if (session.salonSlug !== undefined) token.salonSlug = session.salonSlug;
        if (session.salonName !== undefined) token.salonName = session.salonName;
        if (session.subscriptionStatus !== undefined) token.subscriptionStatus = session.subscriptionStatus;
        if (session.plan !== undefined) token.plan = session.plan;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.salonId = token.salonId as string | undefined;
        session.user.salonSlug = token.salonSlug as string | undefined;
        session.user.salonName = token.salonName as string | undefined;
        session.user.subscriptionStatus = token.subscriptionStatus as string | undefined;
        session.user.plan = token.plan as string | undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
