import { SiteHeader } from "@/components/site-header";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-accent">Salon Onboarding</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Create your salon</h1>
        <p className="mt-2 text-sm text-muted">
          Scaffold your salon&apos;s schedule, staff book, and public client booking page with a 14-day software trial.
        </p>

        <RegisterForm />
      </main>
    </div>
  );
}
