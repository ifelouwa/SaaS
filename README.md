# Atelier — Salon Appointment Scheduling SaaS

A multi-tenant SaaS platform where salon owners subscribe to manage their staff, service menus, operating hours, and appointments, while clients book seamlessly online without platform fees.

---

## 🛠 Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Partial Prerendering, Server Actions)
- **Database & ORM**: PostgreSQL via [Prisma ORM](https://www.prisma.io/) with `@prisma/adapter-pg`
- **Authentication**: [Auth.js / NextAuth v5](https://authjs.dev/) with bcrypt password hashing
- **Billing**: [Stripe Billing](https://stripe.com/billing) (Subscriptions, Customer Portal, Webhooks)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)

---

## 🚀 Key Features

### 1. Authentication & Multi-Tenant Guarding
- **Owner Authentication**: Sign in and registration with atomic tenant creation.
- **Tenant Isolation**: Each salon is tied to `Salon.ownerId`. Public booking URLs are slug-based (`/book/:slug`).
- **Subscription Route Guard**: Middleware intercepts protected `/dashboard/*` routes. If a subscription is `PAST_DUE`, `CANCELED`, or expired, the owner is automatically redirected to the billing portal (`/dashboard/billing`), locking booking and dashboard mutations.

### 2. Booking Availability Engine
- **Availability API**: `GET /api/salons/[slug]/availability?date=YYYY-MM-DD&serviceId=...&staffId=...`
- **Schedule Intersection**: Intersects `SalonHour` business hours with `StaffSchedule` blocks (supporting split shifts).
- **Conflict Subtraction**: Subtracts existing confirmed appointments on a 15-minute grid based on `Service.durationMinutes`.
- **Booking Wizard**: 4-step guest flow at `/book/:slug` (Service $\rightarrow$ Stylist $\rightarrow$ Date & Time $\rightarrow$ Contact Details) with automatic client profile linking.
- **Auto-Seeded Demo**: Visiting `/book/demo-salon` automatically provisions sample stylists, split shifts, and services for immediate testing.

### 3. Stripe Subscription Billing
- **Checkout Sessions**: `POST /api/billing/checkout` creates Stripe Checkout sessions in `subscription` mode for `STARTER` ($29/mo) or `GROWTH` ($79/mo) plans.
- **Stripe Webhooks**: `POST /api/billing/webhook` listens for subscription lifecycles:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded` / `invoice.payment_failed`
- **Customer Portal**: `POST /api/billing/portal` generates Stripe Customer Portal sessions for payment method updates and invoice history.
- **Development Simulator**: Interactive state switcher on `/dashboard/billing` allowing live toggling between `ACTIVE`, `TRIALING`, `PAST_DUE`, and `CANCELED` to verify tenant guards instantly.

---

## ⚙️ Local Development

1. **Environment Setup**:
   Copy `.env.example` to `.env` and configure your database and auth secret:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/atelier?schema=public"
   AUTH_SECRET="your-32-character-secret"
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   STRIPE_PRICE_STARTER="price_..."
   STRIPE_PRICE_GROWTH="price_..."
   ```

2. **Install Dependencies & Generate Prisma**:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   ```

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Verify Build & Lint**:
   ```bash
   npm run build
   npm run lint
   ```
