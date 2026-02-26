"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { sileo } from "sileo";

type RegisterResponse = {
  error?: string;
  redirectTo?: string;
};

export function RegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");

  const canGoNext = useMemo(() => {
    if (step === 1) {
      return name.length > 1 && email.length > 3 && password.length >= 8;
    }
    return businessName.length > 1 && businessDescription.length >= 20;
  }, [step, name, email, password, businessName, businessDescription]);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      setStep(2);
      sileo.info({
        title: "Step 1 complete",
        description: "Now add your business profile details.",
      });
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
        businessName,
        businessDescription,
      }),
    });

    const payload = (await response.json()) as RegisterResponse;

    if (!response.ok) {
      sileo.error({
        title: "Registration failed",
        description: payload.error ?? "Unable to create account",
      });
      setIsSubmitting(false);
      return;
    }

    sileo.success({
      title: "Profile created",
      description: "Welcome to Cantara. Opening your portal.",
    });

    router.push(payload.redirectTo ?? "/client");
    router.refresh();
  }

  return (
    <form onSubmit={submitRegistration} className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[color:var(--navy)]/8 p-1 text-xs font-semibold uppercase tracking-[0.12em]">
        <div className={`rounded-lg px-3 py-2 text-center ${step === 1 ? "bg-white text-[color:var(--navy)] shadow-sm" : "text-[color:var(--ink-soft)]"}`}>
          Account
        </div>
        <div className={`rounded-lg px-3 py-2 text-center ${step === 2 ? "bg-white text-[color:var(--navy)] shadow-sm" : "text-[color:var(--ink-soft)]"}`}>
          Business
        </div>
      </div>

      {step === 1 ? (
        <>
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-semibold text-[color:var(--navy)]">
              Full name
            </label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-4 py-3 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
              placeholder="Jane Foster"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[color:var(--navy)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-4 py-3 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
              placeholder="you@business.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[color:var(--navy)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-4 py-3 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
              placeholder="Minimum 8 characters"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="businessName" className="mb-2 block text-sm font-semibold text-[color:var(--navy)]">
              Business name
            </label>
            <input
              id="businessName"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              required
              className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-4 py-3 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
              placeholder="Acme Industrial Holdings"
            />
          </div>
          <div>
            <label
              htmlFor="businessDescription"
              className="mb-2 block text-sm font-semibold text-[color:var(--navy)]"
            >
              What does your business do?
            </label>
            <textarea
              id="businessDescription"
              value={businessDescription}
              onChange={(event) => setBusinessDescription(event.target.value)}
              required
              minLength={20}
              rows={4}
              className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-4 py-3 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
              placeholder="Share a concise overview of your operations, revenue model, and growth goals."
            />
          </div>
        </>
      )}

      <div className="flex gap-3">
        {step === 2 ? (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 rounded-xl border border-[color:var(--navy)]/25 px-4 py-3 text-sm font-semibold text-[color:var(--navy)]"
          >
            Back
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canGoNext || isSubmitting}
          className="flex-1 rounded-xl bg-[color:var(--navy)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--navy-soft)] disabled:opacity-55"
        >
          {step === 1 ? "Continue" : isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </div>

      <p className="text-center text-sm text-[color:var(--ink-soft)]">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-[color:var(--navy)] underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
