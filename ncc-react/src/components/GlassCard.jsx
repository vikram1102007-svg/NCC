import { motion, useReducedMotion } from "framer-motion";

export default function GlassCard({
  children,
  className = "",
  delay = 0,
  hover = false,
  immediate = false
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced || immediate ? false : { opacity: 0, y: 16 }}
      whileInView={reduced || immediate ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hover && !reduced ? { y: -4 } : undefined}
      className={`rounded-xl border border-white/80 bg-white/95 p-5 text-[#102030] shadow-[0_12px_34px_rgba(4,10,18,0.28)] backdrop-blur-md transition-colors sm:p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
