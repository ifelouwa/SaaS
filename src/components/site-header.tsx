import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { signOutOwnerAction } from "@/app/actions/auth";

async function AuthNav() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link href="/dashboard" className="text-muted hover:text-white transition">
          Dashboard
        </Link>
        <Link href="/dashboard/billing" className="text-muted hover:text-white transition">
          Billing
        </Link>
        <form action={signOutOwnerAction} className="inline">
          <button
            type="submit"
            className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs text-muted hover:text-white transition"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/login" className="text-muted hover:text-white transition">
        Sign in
      </Link>
      <Link
        href="/register"
        className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white transition hover:opacity-90"
      >
        Start Free Trial
      </Link>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display text-2xl tracking-tight text-white">
            Atelier
          </Link>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/#plans" className="text-muted hover:text-white transition">
            Plans
          </Link>
          <Suspense
            fallback={
              <div className="flex items-center gap-4 text-sm text-muted">
                <Link href="/login" className="hover:text-white">
                  Sign in
                </Link>
              </div>
            }
          >
            <AuthNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
