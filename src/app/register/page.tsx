import { redirect } from "next/navigation";
import { RegisterWizard } from "@/components/register-wizard";
import { getCurrentUser } from "@/lib/auth";
import { portalRoutes } from "@/lib/constants";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(portalRoutes[user.role]);
  }

  return (
    <main className="min-h-screen px-4 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="fin-card animate-rise rounded-2xl border border-[color:var(--navy)]/8 p-8">
          <p className="text-xs font-semibold tracking-[0.25em] text-[color:var(--navy-soft)] uppercase">
            Cantara Client Onboarding
          </p>
          <h1 className="font-display mt-4 text-4xl leading-tight text-[color:var(--navy)] sm:text-5xl">
            Tell us about your business.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)] sm:text-base">
            This guided wizard captures core company context so the Cantara team can begin review and request
            diligence materials.
          </p>
        </section>

        <section className="fin-card animate-rise animate-delay-1 rounded-2xl border border-[color:var(--navy)]/8 p-8 sm:p-10">
          <h2 className="font-display text-3xl text-[color:var(--navy)]">Create profile</h2>
          <p className="mt-2 mb-6 text-sm text-[color:var(--ink-soft)]">Two quick steps and your portal goes live.</p>
          <RegisterWizard />
        </section>
      </div>
    </main>
  );
}
