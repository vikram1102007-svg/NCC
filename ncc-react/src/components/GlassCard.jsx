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
      className={`rounded-xl border border-white/70 bg-white/85 p-5 shadow-[0_8px_30px_rgba(8,18,30,0.07)] backdrop-blur-md transition-colors sm:p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
