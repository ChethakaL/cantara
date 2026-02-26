"use client";

import { motion } from "framer-motion";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const staggerFast = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export function PortalStagger({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={staggerFast}
      initial="initial"
      animate="animate"
      className="contents"
    >
      {children}
    </motion.div>
  );
}

export function PortalCard({
  children,
  index = 0,
}: {
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      variants={fadeIn}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
      className="contents"
    >
      {children}
    </motion.div>
  );
}

export function PortalClientCard({
  children,
  index = 0,
}: {
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={{ y: -2 }}
      className="contents"
    >
      {children}
    </motion.div>
  );
}
