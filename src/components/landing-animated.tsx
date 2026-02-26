"use client";

import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export function LandingHero({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      {children}
    </motion.div>
  );
}

export function LandingHeroItem({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function LandingMetric({
  value,
  label,
  index,
}: {
  value: string;
  label: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
      className="text-center"
    >
      <motion.p
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: index * 0.1 + 0.2 }}
        className="text-3xl font-bold text-[color:var(--navy)] sm:text-4xl"
      >
        {value}
      </motion.p>
      <p className="mt-2 text-sm font-medium text-[color:var(--ink-soft)]">{label}</p>
    </motion.div>
  );
}

export function LandingPillar({
  icon: Icon,
  title,
  text,
  index,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group fin-card fin-interactive rounded-2xl border border-[color:var(--navy)]/8 bg-white p-8"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: index * 0.1 + 0.15 }}
        className="inline-flex rounded-xl bg-[color:var(--navy-light)] p-3 text-[color:var(--navy)] transition-colors group-hover:bg-[color:var(--navy)] group-hover:text-white"
      >
        <Icon size={22} />
      </motion.div>
      <h3 className="font-display mt-5 text-xl text-[color:var(--navy)]">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">{text}</p>
    </motion.article>
  );
}
