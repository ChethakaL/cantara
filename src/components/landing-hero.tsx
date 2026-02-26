"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

type LandingHeroProps = {
  isLoggedIn: boolean;
  portalHref?: string;
};

export function LandingHero({ isLoggedIn, portalHref }: LandingHeroProps) {
  return (
    <section className="relative min-h-[85vh] w-full overflow-hidden">
      <Image
        src="https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&q=80"
        alt="Professionals in modern office"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[85vh] flex-col justify-center px-4 py-20 sm:px-8 md:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-6"
          >
            <p className="text-xs font-semibold tracking-[0.35em] text-white/80 uppercase">
              Cantara Capital
            </p>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
              className="font-display max-w-3xl text-4xl leading-[1.1] text-white sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Institutional-grade dealflow and diligence for business acquisitions.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="max-w-2xl text-base text-white/90 sm:text-lg"
            >
              Cantara gives business owners a polished onboarding experience and gives your deal team full control
              of requests, uploads, and stage progression.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-wrap gap-3"
            >
              {isLoggedIn && portalHref ? (
                <Link href={portalHref}>
                  <motion.span
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[color:var(--navy)]"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Open your portal
                    <ArrowRight size={18} />
                  </motion.span>
                </Link>
              ) : (
                <>
                  <Link href="/register">
                    <motion.span
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[color:var(--navy)]"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Start onboarding
                      <ArrowRight size={18} />
                    </motion.span>
                  </Link>
                  <Link href="/login">
                    <motion.span
                      className="inline-flex items-center gap-2 rounded-xl border border-white/50 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm"
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.2)" }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Sign in
                    </motion.span>
                  </Link>
                </>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
