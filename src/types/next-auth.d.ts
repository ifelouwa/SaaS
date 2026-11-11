import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    salonId?: string;
    salonSlug?: string;
    salonName?: string;
    subscriptionStatus?: string;
    plan?: string;
  }

  interface Session {
    user: {
      id: string;
      salonId?: string;
      salonSlug?: string;
      salonName?: string;
      subscriptionStatus?: string;
      plan?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    salonId?: string;
    salonSlug?: string;
    salonName?: string;
    subscriptionStatus?: string;
    plan?: string;
  }
}
