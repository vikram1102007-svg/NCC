import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LogOut, Plus, QrCode, Search, ShieldCheck, Trash2 } from "lucide-react";
import { DEFAULT_SETTINGS, Store, buildCsv, computeStats } from "../lib/store";
import GlassCard from "../components/GlassCard";
import CountUpStat from "../components/CountUpStat";

export default function AdminPage({ onToast, onConfirm }) {
  const isDemo = Store.isDemoMode();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("registrations");

  const [loginCreds, setLoginCreds] = useState(() =>
    isDemo ? { email: "admin@ncc.test", password: "NCCDemo400" } : { email: "", password: "" }
  );
  const [loginErr, setLoginErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [tokenLookup, setTokenLookup] = useState("");

  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [settingsForm, setSettingsForm] = useState(DEFAULT_SETTINGS);

  const blankEvent = {
    id: "",
    title: "",
    day: 1,
    time: "10:00 IST (TBA)",
    venue: "Campus Arena (TBA)",
    type: "Individual",
    capacity: 30,
    fee: 0,
    registrationOpen: true,
    subjectToApprovals: false,
    description: "",
    criteriaText: "Valid College ID required\nReport 30 minutes prior"
  };
  const [newEvent, setNewEvent] = useState(blankEvent);

  const refreshAdminData = useCallback(async () => {
    try {
      const [sess, adminOk] = await Promise.all([Store.getSession(), Store.isAdmin()]);
      setSession(sess);
      setIsAdmin(adminOk);
      if (adminOk) {
        const [evList, regList, sett] = await Promise.all([
          Store.getEvents(),
          Store.getAllRegistrations(),
          Store.getSettings()
        ]);
        setEvents(evList);
        setRegs(regList);
        setSettingsForm(sett);
      } else {
        setRegs([]);
      }
    } catch (err) {
      onToast(err.message || "Could not load admin dashboard.", "error");
    } finally {
      setCheckingAuth(false);
    }
  }, [onToast]);

  useEffect(() => {
    refreshAdminData();
    const unsub = Store.onAuthStateChange(() => refreshAdminData());
    const onFocus = () => refreshAdminData();
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshAdminData]);

  const eventsMap = useMemo(() => {
    const m = {};
    events.forEach((e) => {
      m[e.id] = e;
    });
    return m;
  }, [events]);

  const stats = useMemo(() => computeStats(regs), [regs]);

  const filteredRegs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regs.filter((r) => {
      const hay = [r.id, r.qrToken, r.name, r.email, eventsMap[r.eventId]?.title || r.eventId, r.status]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [regs, search, eventsMap]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginErr("");
    setSubmitting(true);
    try {
      await Store.adminLogin(loginCreds);
      await refreshAdminData();
      onToast(isDemo ? "Opened Admin Demo Dashboard." : "Signed in to Organiser Dashboard.", "success");
    } catch (err) {
      setLoginErr(err.message || "Admin sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTokenCheckIn = async (e) => {
    e.preventDefault();
    try {
      const updated = await Store.checkInByToken(tokenLookup);
      setTokenLookup("");
      await refreshAdminData();
      onToast(`Checked in ${updated.name} (${updated.id}). Certificate ready.`, "success");
    } catch (err) {
      onToast(err.message, "error");
    }
  };

  const handleExportCsv = () => {
    if (!regs.length) {
      onToast("No registrations to export yet.", "info");
      return;
    }
    const content = buildCsv(regs, eventsMap);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    a.download = "ncc-registrations.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    onToast(`Exported ${regs.length} registration(s) safely.`, "success");
  };

  const handleUpdateReg = async (regId, patch, toastMessage) => {
    try {
      await Store.updateRegistration(regId, patch);
      await refreshAdminData();
      if (toastMessage) onToast(toastMessage, "success");
    } catch (err) {
      onToast(err.message || "Update failed.", "error");
    }
  };

  const handleDeleteReg = async (reg) => {
    const ok = await onConfirm({
      title: "Delete registration?",
      message: `Permanently delete ${reg.name} (${reg.id})?`,
      confirmLabel: "Delete"
    });
    if (!ok) return;
    try {
      await Store.deleteRegistration(reg.id);
      await refreshAdminData();
      onToast(`Deleted ${reg.id}.`, "info");
    } catch (err) {
      onToast(err.message, "error");
    }
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;
    const isEditing = Boolean(newEvent.id);
    try {
      await Store.saveEvent(newEvent);
      setNewEvent(blankEvent);
      await refreshAdminData();
      onToast(isEditing ? "Updated event." : "Added event.", "success");
    } catch (err) {
      onToast(err.message || "Could not save event.", "error");
    }
  };

  const handleDeleteEvent = async (ev) => {
    const ok = await onConfirm({
      title: "Delete event?",
      message: `Remove "${ev.title}" from the schedule?`,
      confirmLabel: "Delete Event"
    });
    if (!ok) return;
    try {
      await Store.deleteEvent(ev.id);
      await refreshAdminData();
      onToast(`Deleted event ${ev.title}.`, "info");
    } catch (err) {
      onToast(err.message, "error");
    }
  };

  if (checkingAuth) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="ncc-skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-lg px-3 py-10 sm:px-4 sm:py-12">
        <GlassCard>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">
            Event Operations · {isDemo ? "Demo" : "Authorised Access"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-[#0d1b2a]">
            {isDemo ? "Admin Demo Login" : "Organiser / Officer Login"}
          </h1>

          {isDemo ? (
            <div className="mt-3 rounded-md border-l-4 border-[#b88422] bg-[#fdf5e2] p-3 text-xs text-[#5c400b]">
              <strong>DEMO MODE ONLY.</strong> Browser-local prototype. Never use real admin credentials here.
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2 rounded-md border-l-4 border-[#4b5c34] bg-[#eef2e6] p-3 text-xs text-[#2b3c4d]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#4b5c34]" />
              <span>
                Admin access is enforced server-side. Only accounts listed in the authorised organisers table can inspect participant rosters or modify events.
              </span>
            </div>
          )}

          {!isDemo && session && (
            <div className="mt-3 rounded-md border border-[#ebc2be] bg-[#fceceb] p-3 text-xs text-[#a62b21]">
              Signed in as <strong>{session.email}</strong>, which does not have Organiser / Admin privileges.
              <button
                type="button"
                onClick={async () => {
                  await Store.logout();
                  setSession(null);
                  setLoginErr("");
                }}
                className="ml-2 font-bold underline"
              >
                Sign out
              </button>
            </div>
          )}

          {loginErr && (
            <div className="mt-3 rounded-md bg-[#fceceb] p-3 text-sm text-[#a62b21]" role="alert">
              {loginErr}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-4 grid gap-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-bold text-[#2b3c4d]">
                {isDemo ? "Demo Email" : "Organiser Email"}
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={loginCreds.email}
                onChange={(e) => setLoginCreds((p) => ({ ...p, email: e.target.value }))}
                placeholder="officer@college.edu"
                className="mt-1 min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-xs font-bold text-[#2b3c4d]">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={loginCreds.password}
                onChange={(e) => setLoginCreds((p) => ({ ...p, password: e.target.value }))}
                placeholder="Enter password"
                className="mt-1 min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[46px] w-full rounded-md bg-[#d9a742] px-4 py-2.5 text-sm font-bold text-[#08121e] disabled:opacity-50"
            >
              {submitting ? "Verifying..." : isDemo ? "Open Demo Dashboard →" : "Sign In to Admin Panel →"}
            </button>
          </form>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#08121e] to-[#14283e] p-5 text-white shadow-lg sm:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
            Organiser Operations · {isDemo ? "Demo" : "Live Database"}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-4xl">
            Admin Control Panel
          </h1>
          {session && (
            <p className="mt-1 break-all text-xs text-slate-300">{session.email}</p>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border border-white/30 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 sm:flex-none"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={async () => {
              await Store.logout();
              setIsAdmin(false);
              setSession(null);
              onToast("Signed out of Admin panel.", "info");
            }}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md bg-[#d9a742] px-4 py-2 text-xs font-bold text-[#08121e] sm:flex-none"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase text-[#4a5a6b]">Active</span>
          <strong className="mt-1 block font-display text-3xl font-extrabold text-[#0d1b2a]">
            <CountUpStat value={stats.total} />
          </strong>
        </GlassCard>
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase text-[#4a5a6b]">Demo Paid</span>
          <strong className="mt-1 block font-display text-3xl font-extrabold text-[#1b6638]">
            <CountUpStat value={stats.paid} />
          </strong>
        </GlassCard>
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase text-[#4a5a6b]">Present</span>
          <strong className="mt-1 block font-display text-3xl font-extrabold text-[#4b5c34]">
            <CountUpStat value={stats.attended} />
          </strong>
        </GlassCard>
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase text-[#4a5a6b]">Cancelled</span>
          <strong className="mt-1 block font-display text-3xl font-extrabold text-[#a62b21]">
            <CountUpStat value={stats.cancelled} />
          </strong>
        </GlassCard>
      </div>

      {/* Section Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { id: "registrations", label: "Registrations & Check-In" },
          { id: "events", label: "Manage Events" },
          { id: "settings", label: "Event Info & Signatories" }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === t.id
                ? "bg-[#0d1b2a] text-white"
                : "border border-white/25 bg-white/90 text-[#102030]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "registrations" && (
        <div className="mt-6 grid gap-4">
          <GlassCard className="grid gap-3 md:grid-cols-2">
            <form onSubmit={handleTokenCheckIn} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={tokenLookup}
                onChange={(e) => setTokenLookup(e.target.value)}
                placeholder="Enter QR Token or Ref ID (e.g. TKN-...)"
                className="min-h-[44px] w-full min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-[#d9a742] px-4 py-2 text-xs font-bold text-[#08121e]"
              >
                <QrCode className="h-4 w-4" /> Check In
              </button>
            </form>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cadet name, email, event, reference..."
                className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm"
              />
            </div>
          </GlassCard>

          {/* Mobile Card Roster (320px - 767px) */}
          <div className="grid gap-3 md:hidden">
            {filteredRegs.length === 0 ? (
              <GlassCard className="text-center text-sm text-slate-500">
                No matching registrations.
              </GlassCard>
            ) : (
              filteredRegs.map((r) => (
                <GlassCard key={r.id} className="grid gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-[#0d1b2a]">{r.id}</p>
                      <p className="break-all font-mono text-[10px] text-slate-500">{r.qrToken}</p>
                      <p className="mt-1 font-bold text-[#102030]">{r.name}</p>
                      <p className="break-all text-xs text-slate-500">{r.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#eef2e6] px-2.5 py-1 text-[11px] font-bold text-[#4b5c34]">
                      {eventsMap[r.eventId]?.title || r.eventId}
                    </span>
                  </div>
                  {r.teamName ? (
                    <p className="text-xs text-[#4a5a6b]">
                      Team: <strong>{r.teamName}</strong>
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-bold text-[#4a5a6b]">
                      Status
                      <select
                        aria-label={`Status for ${r.id}`}
                        value={r.status}
                        onChange={(e) =>
                          handleUpdateReg(r.id, { status: e.target.value }, `Updated ${r.id} status.`)
                        }
                        className="mt-1 min-h-[44px] w-full rounded border border-slate-300 bg-white px-2 text-xs text-[#102030]"
                      >
                        <option>Registered</option>
                        <option>Confirmed</option>
                        <option>Cancelled</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-bold text-[#4a5a6b]">
                      Payment
                      <select
                        aria-label={`Payment for ${r.id}`}
                        value={r.payment}
                        onChange={(e) =>
                          handleUpdateReg(r.id, { payment: e.target.value }, `Updated ${r.id} payment.`)
                        }
                        className="mt-1 min-h-[44px] w-full rounded border border-slate-300 bg-white px-2 text-xs text-[#102030]"
                      >
                        <option>Demo pending</option>
                        <option>Demo paid</option>
                        <option>No fee (TBA)</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
                    <label className="inline-flex min-h-[44px] items-center gap-2 text-xs font-bold text-[#102030]">
                      <input
                        type="checkbox"
                        aria-label={`Mark ${r.name} present`}
                        checked={Boolean(r.attended)}
                        onChange={(e) =>
                          handleUpdateReg(
                            r.id,
                            { attended: e.target.checked },
                            e.target.checked
                              ? `${r.name} marked Present (certificate issued).`
                              : `${r.name} marked Absent.`
                          )
                        }
                        className="h-5 w-5 accent-[#4b5c34]"
                      />
                      Present
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteReg(r)}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded border border-[#ebc2be] bg-[#fceceb] px-3 py-1.5 text-xs font-bold text-[#a62b21]"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </GlassCard>
              ))
            )}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden overflow-x-auto rounded-xl border border-white/15 bg-white shadow-lg md:block">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-[#0d1b2a] text-[11px] uppercase tracking-wider text-white">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Cadet</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Present</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRegs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No matching registrations.
                    </td>
                  </tr>
                ) : (
                  filteredRegs.map((r) => (
                    <tr key={r.id} className="even:bg-[#f9faf7] hover:bg-[#eef2e6]">
                      <td className="px-4 py-3 font-mono font-semibold">
                        <div>{r.id}</div>
                        <div className="text-[10px] text-slate-500">{r.qrToken}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#102030]">{r.name}</div>
                        <div className="text-slate-500">{r.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {eventsMap[r.eventId]?.title || r.eventId}
                        {r.teamName ? <div className="text-[10px] text-slate-500">Team: {r.teamName}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Desktop status for ${r.id}`}
                          value={r.status}
                          onChange={(e) =>
                            handleUpdateReg(r.id, { status: e.target.value }, `Updated ${r.id} status.`)
                          }
                          className="min-h-[36px] rounded border border-slate-300 bg-white px-2"
                        >
                          <option>Registered</option>
                          <option>Confirmed</option>
                          <option>Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Desktop payment for ${r.id}`}
                          value={r.payment}
                          onChange={(e) =>
                            handleUpdateReg(r.id, { payment: e.target.value }, `Updated ${r.id} payment.`)
                          }
                          className="min-h-[36px] rounded border border-slate-300 bg-white px-2"
                        >
                          <option>Demo pending</option>
                          <option>Demo paid</option>
                          <option>No fee (TBA)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Desktop mark ${r.name} present`}
                          checked={Boolean(r.attended)}
                          onChange={(e) =>
                            handleUpdateReg(
                              r.id,
                              { attended: e.target.checked },
                              e.target.checked
                                ? `${r.name} marked Present (certificate ready).`
                                : `${r.name} marked Absent.`
                            )
                          }
                          className="h-5 w-5 accent-[#4b5c34]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteReg(r)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded border border-[#ebc2be] bg-[#fceceb] px-2.5 py-1 font-bold text-[#a62b21]"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-extrabold text-[#0d1b2a]">
                {newEvent.id ? `Edit Event: ${newEvent.title}` : "Add Event"}
              </h2>
              {newEvent.id && (
                <button
                  type="button"
                  onClick={() => setNewEvent(blankEvent)}
                  className="text-xs font-bold text-[#4b5c34] underline"
                >
                  Cancel edit
                </button>
              )}
            </div>
            <form onSubmit={handleSaveEvent} className="mt-4 grid gap-3">
              <input
                required
                placeholder="Event title (e.g. Tent Pitching)"
                value={newEvent.title}
                onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={newEvent.time}
                  onChange={(e) => setNewEvent((p) => ({ ...p, time: e.target.value }))}
                  placeholder="Time (e.g. 10:00 IST)"
                  className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
                />
                <input
                  value={newEvent.venue}
                  onChange={(e) => setNewEvent((p) => ({ ...p, venue: e.target.value }))}
                  placeholder="Venue"
                  className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newEvent.day}
                  onChange={(e) => setNewEvent((p) => ({ ...p, day: Number(e.target.value) }))}
                  className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value={1}>Day 1</option>
                  <option value={2}>Day 2</option>
                </select>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent((p) => ({ ...p, type: e.target.value }))}
                  className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="Individual">Individual</option>
                  <option value="Team">Team</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={1}
                  value={newEvent.capacity}
                  onChange={(e) => setNewEvent((p) => ({ ...p, capacity: Number(e.target.value) }))}
                  placeholder="Capacity"
                  className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={newEvent.fee}
                  onChange={(e) => setNewEvent((p) => ({ ...p, fee: Number(e.target.value) }))}
                  placeholder="Fee"
                  className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
                />
              </div>
              <label className="flex min-h-[44px] items-center gap-2 text-xs font-semibold text-[#2b3c4d]">
                <input
                  type="checkbox"
                  checked={Boolean(newEvent.subjectToApprovals)}
                  onChange={(e) =>
                    setNewEvent((p) => ({
                      ...p,
                      subjectToApprovals: e.target.checked,
                      registrationOpen: !e.target.checked
                    }))
                  }
                  className="h-4 w-4 accent-[#0d1b2a]"
                />
                Mark as &ldquo;Subject to approvals&rdquo; (locks registration)
              </label>
              <textarea
                rows={2}
                placeholder="Short description"
                value={newEvent.description}
                onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                className="w-full min-w-0 rounded-md border border-slate-300 bg-white p-3 text-sm"
              />
              <textarea
                rows={3}
                placeholder="Criteria checklist (one item per line)"
                value={newEvent.criteriaText}
                onChange={(e) => setNewEvent((p) => ({ ...p, criteriaText: e.target.value }))}
                className="w-full min-w-0 rounded-md border border-slate-300 bg-white p-3 text-sm"
              />
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-[#d9a742] px-4 py-2 text-sm font-bold text-[#08121e]"
              >
                <Plus className="h-4 w-4" /> {newEvent.id ? "Save Changes" : "Add Event"}
              </button>
            </form>
          </GlassCard>

          <div className="grid gap-3">
            {events.map((ev) => (
              <GlassCard key={ev.id} className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <strong className="font-display text-xl text-[#0d1b2a]">{ev.title}</strong>
                  <p className="text-xs text-[#4a5a6b]">
                    Day {ev.day} · {ev.type} · {ev.seatsLeft}/{ev.capacity} left
                    {ev.subjectToApprovals ? " · Subject to approvals" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewEvent({
                        id: ev.id,
                        title: ev.title,
                        day: ev.day,
                        time: ev.time,
                        venue: ev.venue,
                        type: ev.type,
                        capacity: ev.capacity,
                        fee: ev.fee,
                        registrationOpen: ev.registrationOpen,
                        subjectToApprovals: Boolean(ev.subjectToApprovals),
                        description: ev.description,
                        criteriaText: (ev.criteria || []).join("\n")
                      })
                    }
                    className="min-h-[40px] flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#102030] sm:flex-none"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(ev)}
                    className="min-h-[40px] flex-1 rounded border border-[#ebc2be] bg-[#fceceb] px-3 py-1.5 text-xs font-bold text-[#a62b21] sm:flex-none"
                  >
                    Delete
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <GlassCard className="mt-6 max-w-2xl">
          <h2 className="font-display text-2xl font-extrabold text-[#0d1b2a]">
            Editable Event Info &amp; Certificate Signatories
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await Store.updateSettings(settingsForm);
                await refreshAdminData();
                onToast("Updated event info and certificate signatories.", "success");
              } catch (err) {
                onToast(err.message || "Could not update settings.", "error");
              }
            }}
            className="mt-4 grid gap-3"
          >
            <input
              value={settingsForm.eventDatesText}
              onChange={(e) => setSettingsForm((p) => ({ ...p, eventDatesText: e.target.value }))}
              placeholder="Event dates text"
              className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              value={settingsForm.venueText}
              onChange={(e) => setSettingsForm((p) => ({ ...p, venueText: e.target.value }))}
              placeholder="Venue text"
              className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              value={settingsForm.contactEmail}
              onChange={(e) => setSettingsForm((p) => ({ ...p, contactEmail: e.target.value }))}
              placeholder="Contact email"
              className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              value={settingsForm.signatoryLeft}
              onChange={(e) => setSettingsForm((p) => ({ ...p, signatoryLeft: e.target.value }))}
              placeholder="Left certificate signatory"
              className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              value={settingsForm.signatoryRight}
              onChange={(e) => setSettingsForm((p) => ({ ...p, signatoryRight: e.target.value }))}
              placeholder="Right certificate signatory"
              className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-md bg-[#0d1b2a] px-4 py-2 text-sm font-bold text-white"
            >
              Save Settings
            </button>
          </form>
        </GlassCard>
      )}
    </div>
  );
}
