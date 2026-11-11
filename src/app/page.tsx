import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { formatMonthlyPrice, plans } from "@/lib/plans";

const pieces = [
  {
    title: "Bookings",
    body: "A public page per salon. Guests pick a service, a stylist, and an open time. The chair stays yours.",
  },
  {
    title: "Staff schedules",
    body: "Weekly hours, days off, and split shifts. Availability is the overlap of salon hours and the person doing the work.",
  },
  {
    title: "Services",
    body: "Duration and price live on the service. Staff are linked only to the work they actually offer.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
        <p className="text-sm tracking-[0.18em] text-accent uppercase">For salon owners</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          The book, the staff, and the services — one subscription.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
          Atelier is software the salon pays for. Clients book appointments at no charge from
          the platform. You keep the relationship, the schedule, and the service menu.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-accent px-5 py-3 text-sm text-white"
          >
            Open the owner dashboard
          </Link>
          <Link
            href="/book/demo-salon"
            className="rounded-full border border-line bg-card px-5 py-3 text-sm"
          >
            Preview a booking page
          </Link>
        </div>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {pieces.map((piece) => (
            <article key={piece.title} className="rounded-2xl border border-line bg-card p-6">
              <h2 className="font-display text-2xl">{piece.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{piece.body}</p>
            </article>
          ))}
        </section>

        <section id="plans" className="mt-20">
          <h2 className="font-display text-4xl tracking-tight">The owner subscribes</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Billing is for the software, not the haircut. Stripe Checkout and webhooks come
            next; the plan records already exist on each salon.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.id} className="rounded-2xl border border-line bg-card p-6">
                <p className="text-sm text-muted">{plan.name}</p>
                <p className="mt-2 font-display text-4xl">
                  {formatMonthlyPrice(plan.priceMonthlyCents)}
                  <span className="ml-1 font-sans text-base text-muted">/ month</span>
                </p>
                <p className="mt-4 text-sm leading-6 text-muted">{plan.summary}</p>
                <p className="mt-4 text-sm">
                  {plan.staffLimit === null ? "Unlimited staff" : `Up to ${plan.staffLimit} staff`}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
