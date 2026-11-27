import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { Store } from "../lib/store";
import GlassCard from "../components/GlassCard";

export default function PaymentPage({ onToast }) {
  const [params] = useSearchParams();
  const requestedId = params.get("id");
  const isDemo = Store.isDemoMode();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeRegs, setActiveRegs] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sess, evList] = await Promise.all([Store.getSession(), Store.getEvents()]);
      setSession(sess);
      setEvents(evList);
      if (sess) {
        const myRegs = (await Store.getMyRegistrations()).filter((r) => r.status !== "Cancelled");
        setActiveRegs(myRegs);
        setSelectedId((prev) => {
          if (requestedId && myRegs.some((r) => r.id === requestedId)) return requestedId;
          if (prev && myRegs.some((r) => r.id === prev)) return prev;
          return myRegs[0]?.id || "";
        });
      } else {
        setActiveRegs([]);
        setSelectedId("");
      }
    } finally {
      setLoading(false);
    }
  }, [requestedId]);

  useEffect(() => {
    loadData();
    return Store.onAuthStateChange(() => loadData());
  }, [loadData]);

  const eventsMap = useMemo(() => {
    const m = {};
    events.forEach((e) => {
      m[e.id] = e;
    });
    return m;
  }, [events]);

  const currentReg =
    activeRegs.find((r) => r.id === selectedId) || activeRegs[0] || null;

  const handleSimulate = async () => {
    if (!session) {
      onToast("Log in first to simulate demo payment status.", "error");
      return;
    }
    if (!currentReg) {
      onToast("Register for an active event first.", "error");
      return;
    }
    if (currentReg.payment === "Demo paid") {
      onToast("This registration is already marked Demo paid.", "info");
      return;
    }
    setSubmitting(true);
    try {
      await Store.simulatePayment(currentReg.id);
      await loadData();
      onToast("Demo payment status updated. No real money transferred.", "success");
    } catch (err) {
      onToast(err.message || "Could not update payment status.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg px-3 py-8 sm:px-6 sm:py-10">
      <GlassCard>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">
          Payment Flow · Demo Simulation
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-[#0d1b2a]">
          Simulate payment
        </h1>
        <p className="mt-1 text-sm text-[#4a5a6b]">
          This screen demonstrates the UI status toggle only.
        </p>

        {isDemo && (
          <div className="mt-4 rounded-md border-l-4 border-[#b88422] bg-[#fdf5e2] p-3 text-xs text-[#5c400b]">
            <strong>DEMO MODE ONLY.</strong> Browser-local prototype without Supabase sync.
          </div>
        )}

        <div className="mt-3 rounded-md border-l-4 border-[#4b5c34] bg-[#eef2e6] p-3 text-xs text-[#2b3c4d]">
          <strong>No real payment is possible here.</strong>
          <p className="mt-1">
            There is no UPI ID, QR code, gateway, transaction reference, or online money collection. Fee collection remains offline / unit-managed.
          </p>
        </div>

        <div className="mt-5">
          <label htmlFor="payment-registration" className="block text-xs font-bold text-[#2b3c4d]">
            Active registration
          </label>
          <select
            id="payment-registration"
            disabled={loading || !session || activeRegs.length === 0}
            value={currentReg?.id || ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100"
          >
            {loading ? (
              <option value="">Loading registrations...</option>
            ) : !session ? (
              <option value="">Please log in first</option>
            ) : activeRegs.length === 0 ? (
              <option value="">No active registrations yet</option>
            ) : (
              activeRegs.map((r) => (
                <option key={r.id} value={r.id}>
                  {(eventsMap[r.eventId]?.title || r.eventId)} · {r.id} ({r.payment})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-md border border-[#ead6a5] bg-[#fbf3df] px-4 py-3 text-sm font-bold text-[#102030]">
          <span>
            Fee status ({currentReg ? currentReg.payment : session ? "No active regs" : "Not logged in"})
          </span>
          <span>₹{currentReg ? currentReg.fee : 0}</span>
        </div>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading || submitting || !session || !currentReg}
          className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md bg-[#d9a742] px-4 py-3 text-sm font-bold text-[#08121e] shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" />
          {submitting ? "Updating..." : "Simulate demo payment status →"}
        </button>

        <p className="mt-5 text-center text-xs text-[#4a5a6b]">
          <Link to="/my" className="font-bold text-[#4b5c34] underline">
            Return to my registrations
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
