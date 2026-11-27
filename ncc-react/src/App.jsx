import { useCallback, useRef, useState } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import AppShell from "./components/AppShell";
import ToastRegion from "./components/ToastRegion";
import ConfirmModal from "./components/ConfirmModal";
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import AuthPage from "./pages/AuthPage";
import ParticipantPage from "./pages/ParticipantPage";
import AdminPage from "./pages/AdminPage";
import CertificatePage from "./pages/CertificatePage";

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes({ onToast, onConfirm }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <HomePage />
            </PageTransition>
          }
        />
        <Route
          path="/events"
          element={
            <PageTransition>
              <EventsPage />
            </PageTransition>
          }
        />
        <Route
          path="/event"
          element={
            <PageTransition>
              <EventDetailPage />
            </PageTransition>
          }
        />
        <Route
          path="/login"
          element={
            <PageTransition>
              <AuthPage initialTab="login" onToast={onToast} />
            </PageTransition>
          }
        />
        <Route
          path="/register"
          element={
            <PageTransition>
              <AuthPage initialTab="register" onToast={onToast} />
            </PageTransition>
          }
        />
        <Route
          path="/my"
          element={
            <PageTransition>
              <ParticipantPage onToast={onToast} onConfirm={onConfirm} />
            </PageTransition>
          }
        />
        <Route
          path="/admin"
          element={
            <PageTransition>
              <AdminPage onToast={onToast} onConfirm={onConfirm} />
            </PageTransition>
          }
        />
        <Route
          path="/certificate"
          element={
            <PageTransition>
              <CertificatePage />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const resolverRef = useRef(null);

  const onToast = useCallback((message, kind = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-1), { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const onConfirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModal(opts);
    });
  }, []);

  const closeModal = useCallback((result) => {
    setModal(null);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <AppShell>
          <AnimatedRoutes onToast={onToast} onConfirm={onConfirm} />
        </AppShell>
        <ToastRegion toasts={toasts} onDismiss={dismissToast} />
        <ConfirmModal modal={modal} onClose={closeModal} />
      </HashRouter>
    </MotionConfig>
  );
}
