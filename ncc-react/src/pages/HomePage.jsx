import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, ChevronDown, MapPin, ShieldCheck } from "lucide-react";
import { DEFAULT_SETTINGS, Store } from "../lib/store";
import GlassCard from "../components/GlassCard";
import CountUpStat from "../components/CountUpStat";

const FAQS = [
  {
    q: "Are the dates, venue, and registration fee confirmed?",
    a: "Official dates, campus venue, and fees are To be announced and pending organiser approval. Fee amounts remain placeholder / offline-collected."
  },
  {
    q: "Is the Firing event confirmed?",
    a: "No. Firing registration is currently locked and remains strictly subject to approvals from the organising unit and authorised range safety officers."
  },
  {
    q: "How do cadets receive their QR pass and certificate?",
    a: "After registering, cadets receive an opaque-token QR pass in My Portal across any device. Once the organiser marks attendance as Present, a PDF certificate can be downloaded and verified publicly."
  }
];

export default function HomePage() {
  const reduced = useReducedMotion();
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const isDemo = Store.isDemoMode();

  const loadHome = useCallback(async () => {
    try {
      const [evList, sett] = await Promise.all([Store.getEvents(), Store.getSettings()]);
      setEvents(evList);
      setSettings(sett);
    } catch {
      // keep safe initial defaults if network hiccups
    }
  }, []);

  useEffect(() => {
    loadHome();
    const onFocus = () => loadHome();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadHome]);

  const totalSeats = useMemo(
    () => events.reduce((sum, e) => sum + Number(e.capacity || 0), 0),
    [events]
  );

  const [openFaq, setOpenFaq] = useState(0);
  const [targetMs] = useState(() => Date.now() + 45 * 24 * 60 * 60 * 1000);
  const [countdown, setCountdown] = useState({ d: "45", h: "00", m: "00", s: "00" });

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, targetMs - Date.now());
      setCountdown({
        d: String(Math.floor(diff / 86400000)).padStart(2, "0"),
        h: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0"),
        m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"),
        s: String(Math.floor((diff % 60000) / 1000)).padStart(2, "0")
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const day1Events = events.filter((e) => e.day === 1);
  const day2Events = events.filter((e) => e.day === 2);

  return (
    <div>
      {/* Mobile-first Hero (min-h uses dvh-safe proportions) */}
      <section className="relative overflow-hidden bg-[#08121e]/45 py-12 text-white sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "44px 44px"
          }}
        />
        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
              <span className="h-2 w-2 rounded-full bg-[#e7bc62]" />
              Two-Day College NCC Event
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Discipline. Leadership.
              <span className="block text-[#e7bc62]">Ready to Serve.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Mobile-first cadet registration portal for Drill, Quiz, Map Reading, Obstacle Course, and Firing (subject to approvals). {settings.eventDatesText}.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/events"
                className="inline-flex min-h-[46px] items-center justify-center rounded-md bg-[#d9a742] px-5 py-3 text-sm font-bold text-[#08121e] shadow-lg shadow-[#d9a742]/20 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              >
                View events →
              </Link>
              <Link
                to="/register"
                className="inline-flex min-h-[46px] items-center justify-center rounded-md border border-white/35 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10 active:scale-[0.98]"
              >
                Register now
              </Link>
            </div>

            {/* Tentative Countdown */}
            <div className="mt-8">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
                Tentative Event Countdown (Dates TBA)
              </p>
              <div className="grid w-full max-w-sm grid-cols-4 gap-1.5 rounded-xl border border-white/15 bg-white/5 p-2.5 backdrop-blur-md sm:inline-grid sm:w-auto sm:gap-3 sm:p-4">
                {[
                  { v: countdown.d, l: "Days" },
                  { v: countdown.h, l: "Hours" },
                  { v: countdown.m, l: "Mins" },
                  { v: countdown.s, l: "Secs" }
                ].map((u) => (
                  <div key={u.l} className="min-w-0 text-center sm:min-w-[56px]">
                    <strong className="block font-display text-2xl font-extrabold text-[#e7bc62] sm:text-3xl">
                      {u.v}
                    </strong>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                      {u.l}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Animated Crest Card */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#d9a742]/30 bg-white/5 p-6 text-center backdrop-blur-md">
            <div className="relative h-40 w-40">
              <motion.svg
                viewBox="0 0 180 180"
                fill="none"
                className="h-full w-full"
                animate={reduced ? undefined : { rotate: 360 }}
                transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
                aria-hidden="true"
              >
                <circle
                  cx="90"
                  cy="90"
                  r="76"
                  stroke="rgba(217,167,66,0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="8 8"
                />
                <circle cx="90" cy="14" r="4" fill="#d9a742" />
                <circle cx="166" cy="90" r="3" fill="#dce4ce" />
                <circle cx="90" cy="166" r="3" fill="#d9a742" />
              </motion.svg>
              <svg
                viewBox="0 0 120 120"
                fill="none"
                className="absolute inset-0 m-auto h-24 w-24"
                aria-hidden="true"
              >
                <path
                  d="M60 12L98 28V58C98 84 82 102 60 108C38 102 22 84 22 58V28L60 12Z"
                  stroke="#d9a742"
                  strokeWidth="2.5"
                  fill="rgba(217,167,66,0.1)"
                />
                <path
                  d="M60 36L66 51L82 52L70 62L74 78L60 70L46 78L50 62L38 52L54 51L60 36Z"
                  fill="#e7bc62"
                />
              </svg>
            </div>
            <span className="mt-3 rounded-full bg-[#d9a742]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#e7bc62]">
              Placeholder Crest
            </span>
            <p className="mt-2 font-display text-2xl font-extrabold uppercase tracking-wide">
              Unity &amp; Discipline
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {settings.venueText}
            </p>
          </div>
        </div>
      </section>

      {/* Animated Stats */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard>
            <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">
              Planned Events
            </span>
            <strong className="mt-2 block font-display text-4xl font-extrabold text-[#0d1b2a]">
              <CountUpStat value={events.length} />
            </strong>
          </GlassCard>
          <GlassCard delay={0.05}>
            <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">
              {isDemo ? "Total Demo Slots" : "Total Event Slots"}
            </span>
            <strong className="mt-2 block font-display text-4xl font-extrabold text-[#0d1b2a]">
              <CountUpStat value={totalSeats} />
            </strong>
          </GlassCard>
          <GlassCard delay={0.1}>
            <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">
              Event Format
            </span>
            <strong className="mt-2 block font-display text-4xl font-extrabold text-[#4b5c34]">
              <CountUpStat value={2} suffix=" Days" />
            </strong>
          </GlassCard>
        </div>
      </section>

      {/* Two-Day Schedule loaded directly from Store */}
      <section className="border-y border-white/10 bg-[#0d1b2a]/70 py-14 text-white backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
                Live Data Schedule
              </p>
              <h2 className="mt-1 font-display text-4xl font-extrabold uppercase sm:text-5xl">
                Two-Day <span className="text-[#e7bc62]">Programme</span>
              </h2>
            </div>
            <Link
              to="/events"
              className="inline-flex min-h-[44px] items-center rounded-md border border-white/25 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10"
            >
              Filter &amp; Search Events →
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-white/15 bg-[#14283e] p-6">
              <span className="rounded-full bg-[#d9a742]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#e7bc62]">
                Day 01 · Date TBA
              </span>
              <h3 className="mt-3 font-display text-2xl font-extrabold uppercase">
                Parade, Drill &amp; Quiz
              </h3>
              <ul className="mt-4 divide-y divide-white/10">
                {day1Events.map((ev) => (
                  <li key={ev.id} className="flex items-start justify-between gap-3 py-3.5">
                    <div>
                      <p className="text-xs font-bold text-[#e7bc62]">{ev.time}</p>
                      <Link
                        to={`/event?id=${ev.id}`}
                        className="mt-0.5 block font-display text-xl font-bold hover:text-[#e7bc62]"
                      >
                        {ev.title}
                      </Link>
                      <p className="text-xs text-slate-300">{ev.venue}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-200">
                      {ev.seatsLeft} left
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[#dce4ce] bg-[#eef2e6] p-6 text-[#102030]">
              <span className="rounded-full bg-[#0d1b2a] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                Day 02 · Date TBA
              </span>
              <h3 className="mt-3 font-display text-2xl font-extrabold uppercase">
                Field Craft, Obstacles &amp; Range
              </h3>
              <ul className="mt-4 divide-y divide-[#cfd8c2]">
                {day2Events.map((ev) => (
                  <li key={ev.id} className="flex items-start justify-between gap-3 py-3.5">
                    <div>
                      <p className="text-xs font-bold text-[#4b5c34]">{ev.time}</p>
                      <Link
                        to={`/event?id=${ev.id}`}
                        className="mt-0.5 block font-display text-xl font-bold hover:text-[#4b5c34]"
                      >
                        {ev.title} {ev.subjectToApprovals ? "(Subject to approvals)" : ""}
                      </Link>
                      <p className="text-xs text-[#4a5a6b]">{ev.venue}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#dce4ce] px-2.5 py-1 text-[10px] font-bold uppercase text-[#4b5c34]">
                      {ev.seatsLeft} left
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Registration Guide */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
          Cadet Onboarding
        </p>
        <h2 className="mt-1 font-display text-4xl font-extrabold uppercase text-white">
          How to <span className="text-[#e7bc62]">Register</span>
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              n: "1",
              title: "Check Event Criteria",
              text: "Filter Day 1 and Day 2 events, review eligibility checklists, and check seats remaining."
            },
            {
              n: "2",
              title: "Sign Up & Enrol",
              text: "Create your cadet demo profile, enter a squad/team name for team events, and submit."
            },
            {
              n: "3",
              title: "QR Pass & Certificate",
              text: "Show your opaque-token QR pass at check-in and download your PDF certificate once marked present."
            }
          ].map((s, idx) => (
            <GlassCard key={s.n} delay={idx * 0.06} hover>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0d1b2a] font-display text-lg font-extrabold text-[#e7bc62]">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-2xl font-bold text-[#0d1b2a]">{s.title}</h3>
              <p className="mt-1.5 text-sm text-[#4a5a6b]">{s.text}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* FAQ Accordion & Contact */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
              Briefing &amp; FAQ
            </p>
            <h2 className="mt-1 font-display text-3xl font-extrabold uppercase text-white">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 grid gap-3">
              {FAQS.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={item.q}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : i)}
                      aria-expanded={isOpen}
                      className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold text-[#102030] hover:bg-slate-50"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 px-4 py-3 text-sm text-[#4a5a6b]">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <GlassCard className="flex flex-col justify-between bg-[#0d1b2a]/95 text-white">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
                Unit Coordination
              </p>
              <h2 className="mt-1 font-display text-3xl font-extrabold uppercase">
                Reporting &amp; Contact
              </h2>
              <div className="mt-5 grid gap-3 text-sm text-slate-300">
                <p className="flex items-start gap-2.5">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#e7bc62]" />
                  <span>{settings.eventDatesText}</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#e7bc62]" />
                  <span>{settings.venueText}</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e7bc62]" />
                  <span>
                    Contact: {settings.contactEmail} · {settings.contactPhone}
                  </span>
                </p>
              </div>
            </div>
            <Link
              to="/register"
              className="mt-6 inline-flex min-h-[46px] items-center justify-center rounded-md bg-[#d9a742] px-4 py-3 text-sm font-bold text-[#08121e] transition-transform active:scale-[0.98]"
            >
              Start Demo Registration →
            </Link>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
