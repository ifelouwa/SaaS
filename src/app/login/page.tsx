import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-accent">Owner Access</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Sign in to Atelier</h1>
        <p className="mt-2 text-sm text-muted">
          Manage your appointments, stylists, schedule, and software subscription.
        </p>

        <LoginForm />
      </main>
    </div>
  );
}
