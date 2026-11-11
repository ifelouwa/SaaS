export const plans = [
  {
    id: "STARTER",
    name: "Starter",
    priceMonthlyCents: 2900,
    staffLimit: 3,
    allowSplitShifts: false,
    summary: "One location, a public booking page, standard shifts, and up to three stylists.",
  },
  {
    id: "GROWTH",
    name: "Growth",
    priceMonthlyCents: 7900,
    staffLimit: null,
    allowSplitShifts: true,
    summary: "Unlimited staff, advanced split shifts, and room to add more locations later.",
  },
] as const;

export type PlanId = (typeof plans)[number]["id"];

export function formatMonthlyPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
