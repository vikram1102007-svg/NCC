import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function ToastRegion({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed bottom-24 right-4 z-[180] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2 md:bottom-6"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const border =
            t.kind === "error"
              ? "border-l-[#ef4444]"
              : t.kind === "success"
                ? "border-l-[#22c55e]"
                : "border-l-[#d9a742]";
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border-l-4 bg-[#0d1b2a] px-4 py-3 text-sm text-white shadow-xl ${border}`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="min-h-[28px] min-w-[28px] rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
