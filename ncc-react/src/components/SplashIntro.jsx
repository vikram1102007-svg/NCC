import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export default function SplashIntro() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem("ncc_react_splash_seen");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem("ncc_react_splash_seen", "1");
      } catch {}
    }, 950);
    return () => clearTimeout(timer);
  }, [visible, reduced]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#08121e] text-white"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
          aria-hidden="true"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4 px-6 text-center"
          >
            <div className="grid h-16 w-16 place-items-center rounded-lg border-2 border-dashed border-[#d9a742] bg-white/5 text-[#e7bc62]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L20 6V12C20 16.97 16.58 20.93 12 22C7.42 20.93 4 16.97 4 12V6L12 2Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <path
                  d="M12 7L13.5 10.5L17 11L14.3 13.4L15 17L12 15.1L9 17L9.7 13.4L7 11L10.5 10.5L12 7Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div>
              <p className="font-display text-3xl font-extrabold uppercase tracking-wider">
                NCC Two-Day Event
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#e7bc62]">
                Discipline · Leadership · Teamwork
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
