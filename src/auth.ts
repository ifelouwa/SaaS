import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Salon Owner Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            ownedSalons: {
              include: {
                subscription: true,
              },
              take: 1,
            },
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        const salon = user.ownedSalons[0] ?? null;
        const sub = salon?.subscription;

        // Check if a trialing subscription has expired
        let currentStatus = sub?.status ?? "INCOMPLETE";
        if (
          sub?.status === "TRIALING" &&
          sub.trialEndsAt &&
          new Date() > new Date(sub.trialEndsAt)
        ) {
          currentStatus = "PAST_DUE";
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          salonId: salon?.id,
          salonSlug: salon?.slug,
          salonName: salon?.name,
          subscriptionStatus: currentStatus,
          plan: sub?.plan ?? "STARTER",
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
