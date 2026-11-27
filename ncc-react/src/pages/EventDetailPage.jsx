import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, CheckCircle2, MapPin, Users } from "lucide-react";
import { Store } from "../lib/store";
import GlassCard from "../components/GlassCard";

export default function EventDetailPage() {
  const [params] = useSearchParams();
  const id = params.get("id") || "drill";
  const events = useMemo(() => Store.getEvents(), []);
  const event = events.find((e) => e.id === id) || events[0];

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-[#4a5a6b]">Event not found.</p>
        <Link to="/events" className="mt-4 inline-block font-bold text-[#0d1b2a] underline">
          Return to Events
        </Link>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((event.taken / Math.max(1, event.capacity)) * 100));

  return (
    <div className="pb-20 md:pb-0">
      <section className="border-b border-white/10 bg-[#08121e]/50 py-10 text-white sm:py-14">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <Link
            to="/events"
            className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#e7bc62] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> All Events
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
              Day {event.day}
            </span>
            <span className="rounded-full bg-[#d9a742]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#e7bc62]">
              {event.subjectToApprovals ? "Subject to approvals" : event.teamSizeLabel}
            </span>
          </div>
          <h1 className="mt-3 font-display text-4xl font-extrabold uppercase sm:text-5xl">
            {event.title} {event.subjectToApprovals ? "(Subject to approvals)" : ""}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {event.description}
          </p>
          <div className="mt-6 hidden gap-3 md:flex">
            <Link
              to={`/register?event=${event.id}`}
              className="inline-flex min-h-[46px] items-center rounded-md bg-[#d9a742] px-5 py-2.5 text-sm font-bold text-[#08121e] hover:bg-[#e7bc62]"
            >
              Register for {event.title} →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-2">
        <GlassCard>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">
            Schedule &amp; Venue
          </p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0d1b2a]">
            Event Briefing
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-start gap-2.5">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#4b5c34]" />
              <div>
                <dt className="font-bold text-[#102030]">Day &amp; Time</dt>
                <dd className="text-[#4a5a6b]">
                  Day {event.day} · {event.time}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#4b5c34]" />
              <div>
                <dt className="font-bold text-[#102030]">Venue</dt>
                <dd className="text-[#4a5a6b]">{event.venue}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#4b5c34]" />
              <div>
                <dt className="font-bold text-[#102030]">Participation Format</dt>
                <dd className="text-[#4a5a6b]">
                  {event.type} ({event.teamSizeLabel}) ·{" "}
                  {event.fee > 0 ? `Demo fee ₹${event.fee}` : "Fee TBA"}
                </dd>
              </div>
            </div>
          </dl>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="flex justify-between text-xs font-bold text-[#4a5a6b]">
              <span>
                {event.seatsLeft} of {event.capacity} seats remaining
              </span>
              <span>{event.seatsLeft === 0 ? "Full" : "Open in Demo"}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4b5c34] to-[#d9a742]"
                style={{ width: `${Math.max(8, pct)}%` }}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard delay={0.05}>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">
            Eligibility &amp; Rules
          </p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0d1b2a]">
            Criteria Checklist
          </h2>
          <ul className="mt-4 grid gap-3">
            {event.criteria.map((c) => (
              <li key={c} className="flex items-start gap-2.5 text-sm text-[#2b3c4d]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4b5c34]" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          {event.subjectToApprovals && (
            <div className="mt-5 rounded-md border-l-4 border-[#b88422] bg-[#fdf5e2] p-3 text-xs text-[#5c400b]">
              <strong>Notice:</strong> Firing is not confirmed yet and remains strictly subject to official approvals and range safety clearance.
            </div>
          )}
        </GlassCard>
      </section>

      {/* Sticky mobile CTA above bottom nav */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+55px)] left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-md md:hidden">
        <Link
          to={`/register?event=${event.id}`}
          className="flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#d9a742] px-4 py-2.5 text-sm font-bold text-[#08121e] shadow"
        >
          Register for {event.title} →
        </Link>
      </div>
    </div>
  );
}
