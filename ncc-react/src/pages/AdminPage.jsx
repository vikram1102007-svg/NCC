import { useMemo, useState } from "react";
import { Download, LogOut, Plus, QrCode, Search, Trash2 } from "lucide-react";
import { Store, buildCsv, computeStats } from "../lib/store";
import GlassCard from "../components/GlassCard";
import CountUpStat from "../components/CountUpStat";

export default function AdminPage({ onToast, onConfirm }) {
  const [tick, setTick] = useState(0);
  const [isAdmin, setIsAdmin] = useState(() => Store.isAdmin());
  const [tab, setTab] = useState("registrations");
  const [loginCreds, setLoginCreds] = useState({
    email: "admin@ncc.test",
    password: "NCCDemo400"
  });
  const [loginErr, setLoginErr] = useState("");
  const [search, setSearch] = useState("");
  const [tokenLookup, setTokenLookup] = useState("");

  const events = useMemo(() => Store.getEvents(), [tick]);
  const eventsMap = useMemo(() => {
    const m = {};
    events.forEach((e) => {
      m[e.id] = e;
    });
    return m;
  }, [events]);

  const regs = useMemo(() => Store.getAllRegistrations(), [tick]);
  const stats = useMemo(() => computeStats(regs), [regs]);
  const [settingsForm, setSettingsForm] = useState(() => Store.getSettings());

  const blankEvent = {
    id: "",
    title: "",
    day: 1,
    time: "10:00 IST (TBA)",
    venue: "Campus Arena (TBA)",
    type: "Individual",
    capacity: 30,
    fee: 0,
    subjectToApprovals: false,
    description: "",
    criteriaText: "Valid College ID required\nReport 30 minutes prior"
  };
  const [newEvent, setNewEvent] = useState(blankEvent);

  const filteredRegs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regs.filter((r) => {
      const hay = [r.id, r.qrToken, r.name, r.email, eventsMap[r.eventId]?.title || r.eventId, r.status]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [regs, search, eventsMap]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginErr("");
    try {
      Store.adminLogin(loginCreds);
      setIsAdmin(true);
      onToast("Opened Admin Demo Dashboard.", "success");
    } catch (err) {
      setLoginErr(err.message);
    }
  };

  const handleTokenCheckIn = (e) => {
    e.preventDefault();
    try {
      const updated = Store.checkInByToken(tokenLookup);
      setTokenLookup("");
      setTick((t) => t + 1);
      onToast(`Checked in ${updated.name} (${updated.id}).`, "success");
    } catch (err) {
      onToast(err.message, "error");
    }
  };

  const handleExportCsv = () => {
    if (!regs.length) {
      onToast("No demo registrations to export yet.", "info");
      return;
    }
    const content = buildCsv(regs, eventsMap);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    a.download = "ncc-demo-registrations.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    onToast(`Exported ${regs.length} registration(s) safely.`, "success");
  };

  const handleDeleteReg = async (reg) => {
    const ok = await onConfirm({
      title: "Delete demo registration?",
      message: `Permanently delete ${reg.name} (${reg.id})?`,
      confirmLabel: "Delete"
    });
    if (!ok) return;
    Store.deleteRegistration(reg.id);
    setTick((t) => t + 1);
    onToast(`Deleted ${reg.id}.`, "info");
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;
    const isEditing = Boolean(newEvent.id);
    Store.saveEvent(newEvent);
    setNewEvent(blankEvent);
    setTick((t) => t + 1);
    onToast(isEditing ? "Updated event in Demo Store." : "Added event to Demo Store.", "success");
  };

  const handleDeleteEvent = async (ev) => {
    const ok = await onConfirm({
      title: "Delete event?",
      message: `Remove "${ev.title}" from the demo schedule?`,
      confirmLabel: "Delete Event"
    });
    if (!ok) return;
    Store.deleteEvent(ev.id);
    setTick((t) => t + 1);
    onToast(`Deleted event ${ev.title}.`, "info");
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-12">
        <GlassCard>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4b5c34]">
            Event Operations · Demo
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-[#0d1b2a]">
            Admin Demo Login
          </h1>
          <div className="mt-3 rounded-md border-l-4 border-[#b88422] bg-[#fdf5e2] p-3 text-xs text-[#5c400b]">
            <strong>DEMO MODE ONLY.</strong> Browser-local prototype. Never use real admin credentials here.
          </div>
          {loginErr && (
            <div className="mt-3 rounded-md bg-[#fceceb] p-3 text-sm text-[#a62b21]" role="alert">
              {loginErr}
            </div>
          )}
          <form onSubmit={handleLogin} className="mt-4 grid gap-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-bold text-[#2b3c4d]">
                Demo Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={loginCreds.email}
                onChange={(e) => setLoginCreds((p) => ({ ...p, email: e.target.value }))}
                className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-xs font-bold text-[#2b3c4d]">
                Demo Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={loginCreds.password}
                onChange={(e) => setLoginCreds((p) => ({ ...p, password: e.target.value }))}
                className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <button
              type="submit"
              className="min-h-[46px] w-full rounded-md bg-[#d9a742] px-4 py-2.5 text-sm font-bold text-[#08121e]"
            >
              Open Demo Dashboard →
            </button>
          </form>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#08121e] to-[#14283e] p-6 text-white shadow-lg">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
            Organiser Operations · Demo
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            Admin Control Panel
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-[#d9a742] px-4 py-2 text-xs font-bold text-[#08121e]"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              Store.logout();
              setIsAdmin(false);
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-white/30 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">Active</span>
          <strong className="mt-1 block font-display text-3xl font-extrabold text-[#0d1b2a]">
            <CountUpStat value={stats.total} />
          </strong>
        </GlassCard>
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">Demo Paid</span>
          <strong className="mt-1 block font-display text-3xl font-extrabold text-[#1b6638]">
            <CountUpStat value={stats.paid} />
          </strong>
        </GlassCard>
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">Pending</span>
          <strong className="mt-1 block font-display text-3xl font-extrabold text-[#875c10]">
            <CountUpStat value={stats.pending} />
          </strong>
        </GlassCard>
        <GlassCard immediate>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4a5a6b]">Present</span>
          <strong className="mt-1 block font-display text-3xl font-extrabold text-[#4b5c34]">
            <CountUpStat value={stats.attended} />
          </strong>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { id: "registrations", label: "Registrations & Check-in" },
          { id: "events", label: "Manage Events" },
          { id: "settings", label: "Venue, Contact & Signatories" }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider ${
              tab === t.id
                ? "bg-[#d9a742] text-[#08121e]"
                : "border border-white/25 bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "registrations" && (
        <div className="mt-6 grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <form onSubmit={handleTokenCheckIn} className="flex gap-2">
              <label htmlFor="token-checkin" className="sr-only">
                QR token check-in
              </label>
              <input
                id="token-checkin"
                value={tokenLookup}
                onChange={(e) => setTokenLookup(e.target.value)}
                placeholder="Check-in by QR token (TKN-...) or Ref"
                className="min-h-[44px] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-[#4b5c34] px-4 py-2 text-xs font-bold text-white"
              >
                <QrCode className="h-4 w-4" /> Mark Present
              </button>
            </form>

            <div className="relative">
              <label htmlFor="admin-search" className="sr-only">
                Search registrations
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="admin-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, ref, event..."
                className="min-h-[44px] w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
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
                      No matching demo registrations.
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
                          aria-label={`Status for ${r.id}`}
                          value={r.status}
                          onChange={(e) => {
                            Store.updateRegistration(r.id, { status: e.target.value });
                            setTick((t) => t + 1);
                            onToast(`Updated ${r.id} status.`, "success");
                          }}
                          className="min-h-[36px] rounded border border-slate-300 bg-white px-2"
                        >
                          <option>Registered</option>
                          <option>Confirmed</option>
                          <option>Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Payment for ${r.id}`}
                          value={r.payment}
                          onChange={(e) => {
                            Store.updateRegistration(r.id, { payment: e.target.value });
                            setTick((t) => t + 1);
                            onToast(`Updated ${r.id} payment.`, "success");
                          }}
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
                          aria-label={`Mark ${r.name} present`}
                          checked={Boolean(r.attended)}
                          onChange={(e) => {
                            Store.updateRegistration(r.id, { attended: e.target.checked });
                            setTick((t) => t + 1);
                            onToast(
                              e.target.checked
                                ? `${r.name} marked Present (certificate ready).`
                                : `${r.name} marked Absent.`,
                              "info"
                            );
                          }}
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
                {newEvent.id ? `Edit Event: ${newEvent.title}` : "Add Demo Event"}
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
                className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newEvent.time}
                  onChange={(e) => setNewEvent((p) => ({ ...p, time: e.target.value }))}
                  placeholder="Time (e.g. 10:00 IST)"
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
                />
                <input
                  value={newEvent.venue}
                  onChange={(e) => setNewEvent((p) => ({ ...p, venue: e.target.value }))}
                  placeholder="Venue"
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newEvent.day}
                  onChange={(e) => setNewEvent((p) => ({ ...p, day: Number(e.target.value) }))}
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value={1}>Day 1</option>
                  <option value={2}>Day 2</option>
                </select>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent((p) => ({ ...p, type: e.target.value }))}
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
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
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={newEvent.fee}
                  onChange={(e) => setNewEvent((p) => ({ ...p, fee: Number(e.target.value) }))}
                  placeholder="Demo fee"
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#2b3c4d]">
                <input
                  type="checkbox"
                  checked={Boolean(newEvent.subjectToApprovals)}
                  onChange={(e) =>
                    setNewEvent((p) => ({ ...p, subjectToApprovals: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#0d1b2a]"
                />
                Mark as &ldquo;Subject to approvals&rdquo;
              </label>
              <textarea
                rows={2}
                placeholder="Short description"
                value={newEvent.description}
                onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                className="rounded-md border border-slate-300 bg-white p-3 text-sm"
              />
              <textarea
                rows={3}
                placeholder="Criteria checklist (one item per line)"
                value={newEvent.criteriaText}
                onChange={(e) => setNewEvent((p) => ({ ...p, criteriaText: e.target.value }))}
                className="rounded-md border border-slate-300 bg-white p-3 text-sm"
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
              <GlassCard key={ev.id} className="flex items-center justify-between gap-3">
                <div>
                  <strong className="font-display text-xl text-[#0d1b2a]">{ev.title}</strong>
                  <p className="text-xs text-[#4a5a6b]">
                    Day {ev.day} · {ev.type} · {ev.seatsLeft}/{ev.capacity} left
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
                        subjectToApprovals: Boolean(ev.subjectToApprovals),
                        description: ev.description,
                        criteriaText: (ev.criteria || []).join("\n")
                      })
                    }
                    className="min-h-[40px] rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#102030]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(ev)}
                    className="min-h-[40px] rounded border border-[#ebc2be] bg-[#fceceb] px-3 py-1.5 text-xs font-bold text-[#a62b21]"
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
            onSubmit={(e) => {
              e.preventDefault();
              Store.updateSettings(settingsForm);
              onToast("Updated event info and certificate signatories.", "success");
            }}
            className="mt-4 grid gap-3"
          >
            <input
              value={settingsForm.eventDatesText}
              onChange={(e) => setSettingsForm((p) => ({ ...p, eventDatesText: e.target.value }))}
              placeholder="Event dates text"
              className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              value={settingsForm.venueText}
              onChange={(e) => setSettingsForm((p) => ({ ...p, venueText: e.target.value }))}
              placeholder="Venue text"
              className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              value={settingsForm.contactEmail}
              onChange={(e) => setSettingsForm((p) => ({ ...p, contactEmail: e.target.value }))}
              placeholder="Contact email"
              className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              value={settingsForm.signatoryLeft}
              onChange={(e) => setSettingsForm((p) => ({ ...p, signatoryLeft: e.target.value }))}
              placeholder="Left certificate signatory"
              className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <input
              value={settingsForm.signatoryRight}
              onChange={(e) => setSettingsForm((p) => ({ ...p, signatoryRight: e.target.value }))}
              placeholder="Right certificate signatory"
              className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-sm"
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
