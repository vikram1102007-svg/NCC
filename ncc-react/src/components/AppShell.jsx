import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp, CalendarDays, ClipboardCheck, Home, Shield, User } from "lucide-react";
import { Store } from "../lib/store";
import AnimatedBackground from "./AnimatedBackground";
import SplashIntro from "./SplashIntro";

const MOBILE_TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/register", label: "Register", icon: ClipboardCheck },
  { to: "/my", label: "My Portal", icon: User },
  { to: "/admin", label: "Admin", icon: Shield }
];

export default function AppShell({ children }) {
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const location = useLocation();
  const settings = Store.getSettings();
  const isDemo = Store.isDemoMode();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      setShowTop(window.scrollY > 360);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <AnimatedBackground />
      <SplashIntro />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[210] focus:rounded-md focus:bg-[#d9a742] focus:px-4 focus:py-2 focus:font-bold focus:text-[#08121e]"
      >
        Skip to content
      </a>

      {/* Sticky Shrinking Header */}
      <header
        className={`sticky top-0 z-50 border-b border-white/15 bg-[#0d1b2a]/95 text-white backdrop-blur-md transition-all duration-200 ${
          scrolled ? "shadow-lg" : ""
        }`}
      >
        <div
          className={`mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 transition-all duration-200 sm:px-6 ${
            scrolled ? "h-14" : "h-[68px]"
          }`}
        >
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded border border-dashed border-[#d9a742]/75 bg-white/5 text-[#e7bc62]"
              aria-label="College NCC logo placeholder"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-display text-lg font-extrabold uppercase tracking-wider sm:text-xl">
                NCC Two-Day Event
              </span>
              <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                {isDemo ? "Demo Mode · Placeholder Logo" : "College Unit Portal"}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary navigation">
            {[
              { to: "/", label: "Home" },
              { to: "/events", label: "Events" },
              { to: "/register", label: "Register" },
              { to: "/login", label: "Login" },
              { to: "/my", label: "My Portal" }
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `relative py-2 text-sm font-semibold transition-colors ${
                    isActive ? "text-white" : "text-slate-300 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="desktop-nav-underline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d9a742]"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `inline-flex min-h-[40px] items-center rounded border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  isActive
                    ? "border-[#d9a742] bg-[#d9a742] text-[#08121e]"
                    : "border-[#d9a742]/60 text-[#e7bc62] hover:bg-[#d9a742] hover:text-[#08121e]"
                }`
              }
            >
              Admin
            </NavLink>
          </nav>

          {/* Compact mobile badge */}
          <span className="inline-flex shrink-0 items-center rounded-full border border-[#d9a742]/40 bg-[#d9a742]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#e7bc62] md:hidden">
            {isDemo ? "Demo" : "Live"}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Institutional Footer */}
      <footer className="pb-safe-nav border-t-[3px] border-[#4b5c34] bg-[#08121e] text-slate-300">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <p className="font-display text-lg font-extrabold uppercase tracking-wider text-white">
                College NCC Two-Day Event
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Organised by the College NCC Unit. Event details, official dates, and placeholder logos await formal committee approval.
              </p>
            </div>
            <div>
              <p className="font-display text-lg font-extrabold uppercase tracking-wider text-white">
                Quick Links
              </p>
              <ul className="mt-2 grid gap-2 text-xs">
                <li>
                  <Link className="hover:text-[#e7bc62]" to="/events">
                    Events &amp; Criteria
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-[#e7bc62]" to="/register">
                    Cadet Registration
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-[#e7bc62]" to="/my">
                    My Portal &amp; QR Pass
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-[#e7bc62]" to="/certificate">
                    Verify Certificate
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-display text-lg font-extrabold uppercase tracking-wider text-white">
                Unit Contact
              </p>
              <ul className="mt-2 grid gap-2 text-xs text-slate-400">
                <li>{settings.venueText}</li>
                <li>Email: {settings.contactEmail}</li>
                <li>Phone: {settings.contactPhone}</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-5 text-[11px] text-slate-400">
            <span>© {new Date().getFullYear()} College NCC Event Portal</span>
            <span>Demo mode only · No real payments or official emblems</span>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Navigation Bar (44px+ touch targets & safe-area) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/15 bg-[#08121e]/95 px-1 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden"
        aria-label="Mobile bottom navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active =
              tab.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold transition-colors ${
                  active ? "text-[#e7bc62]" : "text-slate-300"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-[#d9a742]"
                  />
                )}
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Back to Top */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-20 right-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-[#d9a742]/50 bg-[#0d1b2a] text-[#e7bc62] shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
