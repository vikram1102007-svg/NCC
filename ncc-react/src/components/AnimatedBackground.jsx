import { motion, useReducedMotion } from "framer-motion";

const PARTICLES = [
  { id: 1, x: "12%", y: "18%", size: 4, duration: 18, dy: -26, dx: 12 },
  { id: 2, x: "78%", y: "14%", size: 3, duration: 22, dy: 24, dx: -14 },
  { id: 3, x: "32%", y: "58%", size: 5, duration: 25, dy: -20, dx: 18 },
  { id: 4, x: "86%", y: "66%", size: 4, duration: 20, dy: -28, dx: -10 },
  { id: 5, x: "52%", y: "82%", size: 3, duration: 24, dy: 18, dx: 14 },
  { id: 6, x: "20%", y: "86%", size: 4, duration: 21, dy: -22, dx: 8 }
];

export default function AnimatedBackground() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f4f5f0]" aria-hidden="true">
      {/* Subtle tactical grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(13,27,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(13,27,42,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }}
      />

      {/* Aurora Orb 1: Deep Navy */}
      <motion.div
        className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#0d1b2a]/15 blur-3xl sm:h-[28rem] sm:w-[28rem]"
        animate={
          reduced
            ? undefined
            : { x: [0, 36, -16, 0], y: [0, 24, 42, 0], scale: [1, 1.08, 0.96, 1] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Aurora Orb 2: Olive Khaki */}
      <motion.div
        className="absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-[#4b5c34]/15 blur-3xl sm:h-[26rem] sm:w-[26rem]"
        animate={
          reduced
            ? undefined
            : { x: [0, -34, 18, 0], y: [0, 38, -14, 0], scale: [1, 0.94, 1.07, 1] }
        }
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Aurora Orb 3: Cadet Gold accent */}
      <motion.div
        className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-[#d9a742]/15 blur-3xl sm:h-96 sm:w-96"
        animate={
          reduced
            ? undefined
            : { x: [0, 28, -28, 0], y: [0, -32, 12, 0], scale: [1, 1.06, 0.95, 1] }
        }
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Subtle floating parallax particles */}
      {!reduced &&
        PARTICLES.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full bg-[#0d1b2a]/20"
            style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
            animate={{
              x: [0, p.dx, 0],
              y: [0, p.dy, 0],
              opacity: [0.22, 0.55, 0.22]
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}

      {/* Grain overlay */}
      <div className="ncc-noise absolute inset-0" />
    </div>
  );
}
