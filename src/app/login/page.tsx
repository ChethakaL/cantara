import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { portalRoutes } from "@/lib/constants";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(portalRoutes[user.role]);
  }

  return (
    <main className="min-h-screen px-4 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1fr_1.05fr]">
        <section className="fin-card animate-rise rounded-2xl border border-[color:var(--navy)]/8 p-8">
          <p className="text-xs font-semibold tracking-[0.25em] text-[color:var(--navy-soft)] uppercase">
            Cantara Access
          </p>
          <h1 className="font-display mt-4 text-4xl leading-tight text-[color:var(--navy)] sm:text-5xl">
            Enter the dealflow platform.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)] sm:text-base">
            Admin and client users authenticate from one secure entry point and are automatically redirected to their
            portal.
          </p>
        </section>

        <section className="fin-card animate-rise animate-delay-1 rounded-2xl border border-[color:var(--navy)]/8 p-8">
          <h2 className="font-display text-3xl text-[color:var(--navy)]">Sign in</h2>
          <p className="mt-2 mb-6 text-sm text-[color:var(--ink-soft)]">Use your email and password to continue.</p>
          <LoginForm />
          {process.env.DEMO_ADMIN_EMAIL && process.env.DEMO_ADMIN_PASSWORD ? (
            <div className="mt-6 rounded-xl border border-[color:var(--navy)]/15 bg-[color:var(--navy-light)]/30 px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.12em] text-[color:var(--ink-soft)] uppercase">
                Demo admin credentials
              </p>
              <p className="mt-1.5 font-mono text-sm text-[color:var(--navy)]">
                {process.env.DEMO_ADMIN_EMAIL} / {process.env.DEMO_ADMIN_PASSWORD}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
