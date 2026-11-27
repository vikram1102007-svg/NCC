import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Store } from "../lib/store";
import GlassCard from "../components/GlassCard";

export default function EventsPage() {
  const [dayFilter, setDayFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const events = useMemo(() => Store.getEvents(), []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 180);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((ev) => {
      const matchDay = dayFilter === "all" || String(ev.day) === dayFilter;
      const matchText =
        !q || `${ev.title} ${ev.description} ${ev.type} ${ev.venue}`.toLowerCase().includes(q);
      return matchDay && matchText;
    });
  }, [events, dayFilter, query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">
            Event Directory
          </p>
          <h1 className="mt-1 font-display text-4xl font-extrabold uppercase text-[#0d1b2a] sm:text-5xl">
            Two-Day <span className="text-[#b88422]">Categories</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#4a5a6b]">
            Filter by Day 1 or Day 2, inspect eligibility criteria, and register. Firing remains strictly subject to approvals.
          </p>
        </div>
        <Link
          to="/register"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#d9a742] px-4 py-2.5 text-sm font-bold text-[#08121e] shadow transition-transform active:scale-[0.98]"
        >
          Register now →
        </Link>
      </div>

      {/* Filter chips with layoutId active indicator + search */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by day">
          {[
            { id: "all", label: `All (${events.length})` },
            { id: "1", label: "Day 1" },
            { id: "2", label: "Day 2" }
          ].map((chip) => {
            const active = dayFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setDayFilter(chip.id)}
                aria-pressed={active}
                className={`relative min-h-[44px] rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  active ? "text-white" : "border border-slate-300 bg-white/85 text-[#102030]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="events-day-pill"
                    className="absolute inset-0 rounded-full bg-[#0d1b2a]"
                  />
                )}
                <span className="relative z-10">{chip.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <label htmlFor="events-search" className="sr-only">
            Search events
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="events-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drill, firing, quiz..."
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white/90 pl-9 pr-3 text-sm text-[#102030] focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
          />
        </div>
      </div>

      {/* Skeleton or Grid */}
      {loading ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-slate-200 bg-white/80 p-5">
              <div className="ncc-skeleton h-5 w-24 rounded-full" />
              <div className="ncc-skeleton mt-4 h-7 w-2/3 rounded" />
              <div className="ncc-skeleton mt-3 h-14 w-full rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white/75 p-10 text-center text-sm text-[#4a5a6b]">
          No events match your current search or day filter.
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ev, idx) => {
            const pct = Math.min(100, Math.round((ev.taken / Math.max(1, ev.capacity)) * 100));
            return (
              <GlassCard key={ev.id} delay={idx * 0.04} hover className="flex flex-col justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#0d1b2a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Day {ev.day}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        ev.subjectToApprovals
                          ? "bg-[#fbf3df] text-[#875c10]"
                          : "bg-[#eef2e6] text-[#4b5c34]"
                      }`}
                    >
                      {ev.subjectToApprovals ? "Subject to approvals" : ev.teamSizeLabel}
                    </span>
                  </div>

                  <h2 className="mt-3 font-display text-2xl font-extrabold text-[#0d1b2a]">
                    {ev.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#4a5a6b]">{ev.description}</p>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-semibold text-[#4a5a6b]">
                      <span>
                        {ev.seatsLeft} of {ev.capacity} seats left
                      </span>
                      <span>{ev.fee > 0 ? `Demo ₹${ev.fee}` : "Fee TBA"}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#4b5c34] to-[#d9a742] transition-all duration-500"
                        style={{ width: `${Math.max(8, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
                  <Link
                    to={`/event?id=${ev.id}`}
                    className="inline-flex min-h-[44px] items-center rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-[#102030] hover:bg-slate-50 active:scale-[0.98]"
                  >
                    Details &amp; Criteria
                  </Link>
                  <Link
                    to={`/register?event=${ev.id}`}
                    className="inline-flex min-h-[44px] items-center rounded-md bg-[#d9a742] px-4 py-2 text-xs font-bold text-[#08121e] hover:bg-[#e7bc62] active:scale-[0.98]"
                  >
                    Register →
                  </Link>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
