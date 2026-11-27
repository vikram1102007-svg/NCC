import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Award, CreditCard, LogOut, PlusCircle, QrCode, XCircle } from "lucide-react";
import { Store, computeStats } from "../lib/store";
import GlassCard from "../components/GlassCard";
import CountUpStat from "../components/CountUpStat";

export default function ParticipantPage({ onToast, onConfirm }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [qrModal, setQrModal] = useState(null);
  const isDemo = Store.isDemoMode();

  const loadAll = useCallback(async () => {
    try {
      const sess = await Store.getSession();
      if (!sess) {
        setSession(null);
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }
      const [evList, myRegs] = await Promise.all([
        Store.getEvents(),
        Store.getMyRegistrations()
      ]);
      setSession(sess);
      setEvents(evList);
      setRegs(myRegs);
    } catch (err) {
      onToast(err.message || "Could not load your registrations.", "error");
    } finally {
      setLoading(false);
    }
  }, [navigate, onToast]);

  useEffect(() => {
    loadAll();
    const unsub = Store.onAuthStateChange(() => loadAll());
    const onFocus = () => loadAll();
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
    };
  }, [loadAll]);

  const eventsMap = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [events]);

  const stats = useMemo(() => computeStats(regs), [regs]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="ncc-skeleton h-32 rounded-2xl" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="ncc-skeleton h-28 rounded-xl" />
          <div className="ncc-skeleton h-28 rounded-xl" />
          <div className="ncc-skeleton h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  const openQrPass = async (reg) => {
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(reg.qrToken, {
        width: 240,
        margin: 2,
        color: { dark: "#0d1b2a", light: "#ffffff" }
      });
      setQrModal({ reg, dataUrl, title: eventsMap[reg.eventId]?.title || reg.eventId });
    } catch {
      onToast("Could not generate QR pass.", "error");
    }
  };

  const handleSimulatePayment = async (regId) => {
    try {
      await Store.simulatePayment(regId);
      await loadAll();
      onToast("Demo payment status updated. No real money transferred.", "success");
    } catch (err) {
      onToast(err.message, "error");
    }
  };

  const handleCancel = async (reg) => {
    const ok = await onConfirm({
      title: "Cancel registration?",
      message: `Cancel ${eventsMap[reg.eventId]?.title || reg.eventId} (${reg.id})?`,
      confirmLabel: "Cancel Registration"
    });
    if (!ok) return;
    try {
      await Store.cancelRegistration(reg.id);
      await loadAll();
      onToast(`Cancelled ${reg.id}.`, "info");
    } catch (err) {
      onToast(err.message, "error");
    }
  };

  const handleDownloadCertificate = async (reg) => {
    try {
      const { jsPDF } = await import("jspdf");
      const cert = await Store.ensureCertificateForReg(reg.id);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFillColor(13, 27, 42);
      doc.rect(0, 0, 297, 210, "F");
      doc.setFillColor(244, 245, 240);
      doc.rect(12, 12, 273, 186, "F");
      doc.setDrawColor(217, 167, 66);
      doc.setLineWidth(1.2);
      doc.rect(18, 18, 261, 174);

      doc.setTextColor(75, 92, 52);
      doc.setFontSize(11);
      doc.text("COLLEGE NCC TWO-DAY EVENT · CERTIFICATE", 148.5, 42, { align: "center" });

      doc.setTextColor(13, 27, 42);
      doc.setFontSize(28);
      doc.text("CERTIFICATE OF PARTICIPATION", 148.5, 62, { align: "center" });

      doc.setFontSize(13);
      doc.setTextColor(74, 90, 107);
      doc.text("This certifies that", 148.5, 84, { align: "center" });

      doc.setFontSize(24);
      doc.setTextColor(13, 27, 42);
      doc.text(cert.participantName, 148.5, 100, { align: "center" });

      doc.setFontSize(13);
      doc.setTextColor(74, 90, 107);
      doc.text(
        `participated in ${cert.eventTitle} (${cert.eventDay}) · Regimental No: ${cert.regimentalNo}`,
        148.5,
        118,
        { align: "center" }
      );

      doc.setFontSize(11);
      doc.text(`Certificate ID: ${cert.certificateId}`, 148.5, 134, { align: "center" });
      doc.text(`Issued: ${new Date(cert.issuedAt).toLocaleDateString()}`, 148.5, 142, {
        align: "center"
      });

      doc.line(42, 166, 112, 166);
      doc.line(185, 166, 255, 166);
      doc.setFontSize(10);
      doc.text(cert.signatoryLeft, 77, 173, { align: "center" });
      doc.text(cert.signatoryRight, 220, 173, { align: "center" });

      doc.save(`NCC-Certificate-${cert.certificateId}.pdf`);
      onToast(`Downloaded PDF certificate (${cert.certificateId}).`, "success");
    } catch (err) {
      onToast(err.message, "error");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-12">
      {/* Profile Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#08121e] to-[#14283e] p-5 text-white shadow-lg sm:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
            Participant Portal · {isDemo ? "Demo" : "Live Sync"}
          </p>
          <h1 className="mt-1 break-words font-display text-2xl font-extrabold sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-1 break-all text-xs text-slate-300">
            {session.email} {session.regimentalNo ? `· ${session.regimentalNo}` : ""}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link
            to="/register"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md bg-[#d9a742] px-4 py-2 text-xs font-bold text-[#08121e] sm:flex-none"
          >
            <PlusCircle className="h-4 w-4" /> Add Event
          </Link>
          <Link
            to="/payment"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border border-white/30 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 sm:flex-none"
          >
            <CreditCard className="h-4 w-4" /> Demo Payment
          </Link>
          <button
            type="button"
            onClick={async () => {
              await Store.logout();
              onToast("Signed out.", "info");
              navigate("/");
            }}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-white/30 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>

      {isDemo ? (
        <div className="mt-4 rounded-md border-l-4 border-[#b88422] bg-[#fdf5e2] p-3 text-xs text-[#5c400b]">
          <strong>DEMO MODE ONLY.</strong> Registrations and certificates shown here are stored locally in this browser.
        </div>
      ) : (
        <div className="mt-4 rounded-md border-l-4 border-[#4b5c34] bg-[#eef2e6] p-3 text-xs text-[#2b3c4d]">
          <strong>Synced Across Devices.</strong> Your registrations, QR check-in passes, attendance, and certificates load directly from the shared NCC database. Payment simulation remains demo-only.
        </div>
      )}

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">
            Active Categories
          </span>
          <strong className="mt-1 block font-display text-4xl font-extrabold text-[#0d1b2a]">
            <CountUpStat value={stats.total} />
          </strong>
        </GlassCard>
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">
            Active Fee Total
          </span>
          <strong className="mt-1 block font-display text-4xl font-extrabold text-[#0d1b2a]">
            <CountUpStat value={stats.feeTotal} prefix="₹" />
          </strong>
        </GlassCard>
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">
            Marked Present
          </span>
          <strong className="mt-1 block font-display text-4xl font-extrabold text-[#4b5c34]">
            <CountUpStat value={stats.attended} />
          </strong>
        </GlassCard>
      </div>

      {/* Registrations */}
      <div className="mt-8 grid gap-4">
        {regs.length === 0 ? (
          <GlassCard className="text-center">
            <p className="text-sm text-[#4a5a6b]">No event registrations yet.</p>
            <Link
              to="/events"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-[#d9a742] px-4 py-2 text-sm font-bold text-[#08121e]"
            >
              Browse Events →
            </Link>
          </GlassCard>
        ) : (
          regs.map((r) => {
            const ev = eventsMap[r.eventId];
            const isCancelled = r.status === "Cancelled";
            const isPaid = r.payment === "Demo paid";
            return (
              <GlassCard key={r.id} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-extrabold text-[#0d1b2a]">
                      {ev?.title || r.eventId}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        isCancelled
                          ? "bg-[#fceceb] text-[#a62b21]"
                          : "bg-[#eef2e6] text-[#4b5c34]"
                      }`}
                    >
                      {r.status}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        isPaid ? "bg-[#e8f5ec] text-[#1b6638]" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.payment}
                    </span>
                    {r.attended && (
                      <span className="rounded-full bg-[#fbf3df] px-2.5 py-0.5 text-[11px] font-bold uppercase text-[#875c10]">
                        Present
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-all text-xs text-[#4a5a6b]">
                    Ref: <strong>{r.id}</strong> · QR Token: <strong>{r.qrToken}</strong>
                    {r.teamName ? ` · Team: ${r.teamName}` : ""}
                  </p>
                  {r.certificateId && (
                    <p className="mt-1 text-xs text-[#1b6638]">
                      Certificate ID:{" "}
                      <Link className="font-bold underline" to={`/certificate?id=${r.certificateId}`}>
                        {r.certificateId}
                      </Link>
                    </p>
                  )}
                </div>

                {!isCancelled && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQrPass(r)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-[#0d1b2a] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#14283e]"
                    >
                      <QrCode className="h-4 w-4" /> QR Pass
                    </button>

                    {Number(r.fee) > 0 && !isPaid && (
                      <button
                        type="button"
                        onClick={() => handleSimulatePayment(r.id)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-[#102030] hover:bg-slate-50"
                      >
                        <CreditCard className="h-4 w-4" /> Simulate Paid
                      </button>
                    )}

                    {r.attended && (
                      <button
                        type="button"
                        onClick={() => handleDownloadCertificate(r)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-[#d9a742] px-3.5 py-2 text-xs font-bold text-[#08121e]"
                      >
                        <Award className="h-4 w-4" /> Certificate PDF
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCancel(r)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[#ebc2be] bg-[#fceceb] px-3.5 py-2 text-xs font-bold text-[#a62b21] hover:bg-[#a62b21] hover:text-white"
                    >
                      <XCircle className="h-4 w-4" /> Cancel
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Opaque-Token QR Pass Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-[#08121e]/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQrModal(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border-t-4 border-[#d9a742] bg-white p-6 text-center shadow-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">
              Opaque Check-In Pass
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0d1b2a]">
              {qrModal.title}
            </h2>
            <img
              src={qrModal.dataUrl}
              alt={`QR pass token ${qrModal.reg.qrToken}`}
              className="mx-auto mt-4 aspect-square w-full max-w-[208px] rounded-lg border border-slate-200 p-2"
            />
            <p className="mt-3 break-all font-mono text-xs font-bold text-[#102030]">
              {qrModal.reg.qrToken}
            </p>
            <p className="mt-1 text-[11px] text-[#4a5a6b]">
              Contains only a random check-in token — no personal data stored inside QR.
            </p>
            <button
              type="button"
              onClick={() => setQrModal(null)}
              className="mt-5 min-h-[44px] w-full rounded-md bg-[#0d1b2a] px-4 py-2 text-sm font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
