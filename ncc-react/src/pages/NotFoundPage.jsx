import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";

export default function NotFoundPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 text-center">
      <GlassCard>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">Error 404</p>
        <h1 className="mt-1 font-display text-6xl font-extrabold text-[#0d1b2a]">404</h1>
        <p className="mt-2 text-sm text-[#4a5a6b]">
          The requested NCC portal route could not be found.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center rounded-md bg-[#d9a742] px-4 py-2 text-sm font-bold text-[#08121e]"
          >
            Return Home
          </Link>
          <Link
            to="/events"
            className="inline-flex min-h-[44px] items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-[#102030]"
          >
            View Events
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
