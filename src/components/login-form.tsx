"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { sileo } from "sileo";

type LoginResponse = {
  error?: string;
  redirectTo?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await response.json()) as LoginResponse;

    if (!response.ok) {
      sileo.error({
        title: "Sign in failed",
        description: payload.error ?? "Unable to sign in",
      });
      setIsSubmitting(false);
      return;
    }

    sileo.success({
      title: "Welcome back",
      description: "Routing you to your portal.",
    });

    router.push(payload.redirectTo ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          required
          className="w-full rounded-xl border border-[color:var(--navy)]/20 bg-white px-4 py-3 text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-[color:var(--navy)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--navy-soft)] disabled:opacity-60"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-center text-sm text-[color:var(--ink-soft)]">
        New client?{" "}
        <Link href="/register" className="font-semibold text-[color:var(--navy)] underline-offset-4 hover:underline">
          Create your account
        </Link>
      </p>
    </form>
  );
}
