"use client";

import { Building2, ChartNoAxesCombined, CircleCheckBig } from "lucide-react";
import { motion } from "framer-motion";
import { LandingMetric, LandingPillar } from "./landing-animated";

const metrics = [
  { label: "Active Targets", value: "23" },
  { label: "Median Review Cycle", value: "11 Days" },
  { label: "Documents Processed", value: "148" },
];

const pillars = [
  {
    icon: Building2,
    title: "Owner Intake",
    text: "Structured onboarding captures the business profile with clarity and speed.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Diligence Workflow",
    text: "Track each candidate by stage and issue focused document requests in one system.",
  },
  {
    icon: CircleCheckBig,
    title: "Investment Readiness",
    text: "Consolidate submissions and move to decision with cleaner execution.",
  },
];

export function LandingMetricsSection() {
  return (
    <section className="border-b border-[color:var(--navy)]/8 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {metrics.map((metric, i) => (
            <LandingMetric
              key={metric.label}
              value={metric.value}
              label={metric.label}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPillarsSection() {
  return (
    <section className="bg-[color:var(--paper)] py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-display text-center text-3xl text-[color:var(--navy)] sm:text-4xl"
        >
          Our Difference
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-4 max-w-2xl text-center text-[color:var(--ink-soft)]"
        >
          Cantara is built for private equity firms who acquire businesses. Give owners a modern portal experience
          while your team maintains full control of the diligence pipeline.
        </motion.p>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar, i) => (
            <LandingPillar
              key={pillar.title}
              icon={pillar.icon}
              title={pillar.title}
              text={pillar.text}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
