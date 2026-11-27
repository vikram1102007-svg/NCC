import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function ConfirmModal({ modal, onClose }) {
  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, onClose]);

  return (
    <AnimatePresence>
      {modal && (
        <motion.div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-[#08121e]/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-xl border-t-4 border-[#d9a742] bg-white p-6 shadow-2xl"
          >
            <h2 id="confirm-modal-title" className="font-display text-2xl font-extrabold text-[#102030]">
              {modal.title}
            </h2>
            <p className="mt-2 text-sm text-[#4a5a6b]">{modal.message}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="min-h-[44px] rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#102030] hover:bg-slate-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onClose(true)}
                className="min-h-[44px] rounded-md bg-[#a62b21] px-4 py-2 text-sm font-bold text-white hover:bg-[#8e2219] active:scale-[0.98]"
                autoFocus
              >
                {modal.confirmLabel || "Confirm"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
