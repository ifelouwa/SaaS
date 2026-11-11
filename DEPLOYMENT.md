# Production Deployment & Infrastructure Runbook

This guide covers live deployment and infrastructure setup for **Atelier** (Salon Scheduling SaaS).

---

## 1. Managed PostgreSQL Setup (Neon / Supabase / AWS RDS)

1. **Create Database**:
   - Create a PostgreSQL database on [Neon](https://neon.tech), [Supabase](https://supabase.com), or [AWS RDS](https://aws.amazon.com/rds/).
   - Ensure connection pooling is enabled if deploying to serverless environments like Vercel.

2. **Sync Schema**:
   Run schema migration to create tables, indexes, and relations:
   ```bash
   npx prisma db push
   ```

3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

---

## 2. Stripe Webhook & Product Configuration

### Local Testing with Stripe CLI
1. Log in to Stripe CLI:
   ```bash
   stripe login
   ```
2. Forward webhook events to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```
3. Copy the signing secret printed in your terminal (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` in `.env`.

4. Trigger test events:
   ```bash
   stripe trigger customer.subscription.updated
   stripe trigger invoice.payment_succeeded
   stripe trigger invoice.payment_failed
   ```

### Production Stripe Configuration
1. In the [Stripe Dashboard](https://dashboard.stripe.com/webhooks):
   - Add endpoint: `https://<YOUR_DOMAIN>/api/billing/webhook`
   - Select events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
2. Copy the **Signing Secret** (`whsec_...`) into your production environment variables (`STRIPE_WEBHOOK_SECRET`).
3. Enable the **Stripe Customer Portal**:
   - Go to **Settings > Billing > Customer portal**.
   - Enable portal access for customers to manage payment methods, cancel subscriptions, and view invoices.

---

## 3. Vercel Deployment

1. **Push Code to Git**:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Atelier salon scheduling SaaS"
   git push origin main
   ```

2. **Import into Vercel**:
   - Connect your GitHub / GitLab repository in Vercel.
   - Framework preset: **Next.js** (Turbopack).

3. **Configure Environment Variables in Vercel**:

| Variable | Description | Example / Source |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| `AUTH_SECRET` | NextAuth encryption secret | `openssl rand -hex 32` |
| `NEXTAUTH_SECRET` | NextAuth legacy compatibility | Same as `AUTH_SECRET` |
| `NEXTAUTH_URL` | Canonical app URL | `https://your-domain.vercel.app` |
| `STRIPE_SECRET_KEY` | Stripe secret API key | `sk_live_...` or `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` or `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `RESEND_API_KEY` | Resend transactional email key | `re_...` |
| `RESEND_FROM_EMAIL` | Verified sending domain | `Atelier <bookings@yourdomain.com>` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Auth token from Twilio console |
| `TWILIO_FROM_PHONE` | Twilio SMS sender number | `+1...` |
| `CRON_SECRET` | Secret token guarding cron route | Random 32+ character string |

4. **Automated Reminders Cron**:
   - The included [`vercel.json`](file:///c:/Users/ifeol/OneDrive/Desktop/SHOWCASE/SaaS/vercel.json) schedules `GET /api/cron/reminders` to run hourly (`0 * * * *`).
   - Vercel automatically includes an `Authorization: Bearer <CRON_SECRET>` header matching your configured secret.

---

## 4. Post-Deployment Smoke Test Checklist

- [ ] Visit `https://<YOUR_DOMAIN>/register` and create a salon owner account.
- [ ] Visit `https://<YOUR_DOMAIN>/dashboard/billing` and test Stripe Checkout (or simulate ACTIVE status).
- [ ] Add 3 stylists in `/dashboard/staff` and confirm the 4th triggers the Growth upgrade prompt.
- [ ] Add services in `/dashboard/services` and assign stylists.
- [ ] Visit the public booking page `https://<YOUR_DOMAIN>/book/<slug>` and place a live test booking.
- [ ] Confirm the appointment appears in `/dashboard/appointments`.
