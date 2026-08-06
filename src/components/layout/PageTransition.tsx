import type { ReactNode } from "react";
import { AnimatePresence, motion, type Variants, useReducedMotion } from "framer-motion";

const pageVariants: Variants = {
  initial: { opacity: 0, y: 12, filter: "blur(2px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(1px)",
    transition: { duration: 0.2, ease: [0.55, 0, 1, 0.45] },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

interface ChildrenProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={reduceMotion ? undefined : pageVariants}
      initial={reduceMotion ? { opacity: 0 } : "initial"}
      animate={reduceMotion ? { opacity: 1 } : "animate"}
      exit={reduceMotion ? { opacity: 0 } : "exit"}
      transition={reduceMotion ? { duration: 0.12 } : undefined}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

export function StaggerList({ children, className = "" }: ChildrenProps) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function FadeUp({ children, className = "", delay = 0 }: ChildrenProps & { delay?: number }) {
  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "" }: ChildrenProps) {
  return <motion.div variants={staggerItem} className={className}>{children}</motion.div>;
}

export function ScaleFade({ children, className = "", delay = 0 }: ChildrenProps & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlideInRight({ children, className = "" }: ChildrenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 28 }}
      transition={{ duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence };
