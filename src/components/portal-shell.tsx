"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LogoutButton } from "./logout-button";

type PortalShellProps = {
  heading: string;
  subheading: string;
  userLabel: string;
  roleLabel: string;
  children: React.ReactNode;
};

export function PortalShell({
  heading,
  subheading,
  userLabel,
  roleLabel,
  children,
}: PortalShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--paper)] pb-16 pt-6 sm:pt-8">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="fin-card mb-8 rounded-2xl border border-[color:var(--navy)]/8 bg-white px-6 py-6 shadow-sm sm:px-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/"
                className="text-xs font-semibold tracking-[0.25em] text-[color:var(--navy-soft)] uppercase transition hover:text-[color:var(--navy)]"
              >
                Cantara Capital Console
              </Link>
              <h1 className="font-display mt-3 text-3xl leading-tight text-[color:var(--navy)] sm:text-5xl">
                {heading}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-soft)] sm:text-base">
                {subheading}
              </p>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--navy)]/10 bg-[color:var(--paper)]/80 px-5 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[color:var(--navy)]">{userLabel}</p>
                <p className="text-xs tracking-[0.12em] text-[color:var(--ink-soft)] uppercase">
                  {roleLabel}
                </p>
              </div>
              <LogoutButton />
            </motion.div>
          </div>
        </motion.header>
        {children}
      </div>
    </div>
  );
}
