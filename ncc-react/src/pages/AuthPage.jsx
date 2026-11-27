import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { Store } from "../lib/store";
import GlassCard from "../components/GlassCard";

export default function AuthPage({ initialTab = "register", onToast }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselected = params.get("event");

  const [tab, setTab] = useState(initialTab);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const session = Store.getSession();
  const events = useMemo(() => Store.getEvents(), []);
  const myRegs = useMemo(() => Store.getMyRegistrations(), []);
  const activeEventIds = useMemo(
    () => new Set(myRegs.filter((r) => r.status !== "Cancelled").map((r) => r.eventId)),
    [myRegs]
  );

  const [selectedEvents, setSelectedEvents] = useState(() =>
    preselected && events.some((e) => e.id === preselected && !activeEventIds.has(e.id))
      ? [preselected]
      : []
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    regimentalNo: "",
    department: "",
    year: "",
    password: "",
    teamName: ""
  });

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const needsTeamName = useMemo(
    () =>
      selectedEvents.some((id) => {
        const ev = events.find((e) => e.id === id);
        return ev?.type === "Team";
      }),
    [selectedEvents, events]
  );

  const demoTotal = useMemo(
    () =>
      selectedEvents.reduce((sum, id) => {
        const ev = events.find((e) => e.id === id);
        return sum + (Number(ev?.fee) || 0);
      }, 0),
    [selectedEvents, events]
  );

  const toggleEvent = (id) => {
    setSelectedEvents((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (selectedEvents.length === 0) {
      setErrorMsg("Select at least one available event.");
      return;
    }
    setSubmitting(true);
    try {
      let user = session;
      if (!user) {
        user = await Store.signup(form);
      }
      const res = Store.registerForEvents(user, selectedEvents, form.teamName);
      if (res.added.length === 0 && res.skipped.length > 0) {
        setErrorMsg(`Could not register: ${res.skipped.join(", ")}`);
        setSubmitting(false);
        return;
      }
      onToast(
        `Registered for ${res.added.length} event(s) in Demo Mode.`,
        "success"
      );
      navigate("/my");
    } catch (err) {
      setErrorMsg(err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      await Store.login(loginForm);
      onToast("Logged in to Demo Participant Portal.", "success");
      navigate("/my");
    } catch (err) {
      setErrorMsg(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        {/* Desktop Brand Briefing Panel */}
        <aside className="hidden flex-col justify-between rounded-2xl bg-gradient-to-br from-[#08121e] to-[#14283e] p-8 text-white lg:flex">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
              Cadet Enrolment · Demo
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold uppercase">
              NCC Two-Day Event Portal
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Create a demo account or log in to manage registrations, view your opaque-token QR pass, and download attendance certificates.
            </p>
          </div>
          <ul className="grid gap-3 text-sm text-slate-300">
            <li>✓ Firing remains strictly subject to approvals</li>
            <li>✓ Duplicate active category submissions prevented</li>
            <li>✓ Team name captured automatically for team events</li>
            <li>✓ Zero real personal data or real payment gateways</li>
          </ul>
        </aside>

        {/* Auth / Registration Card */}
        <GlassCard>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#f4f5f0] p-1" role="tablist">
            {[
              { id: "login", label: "Log In" },
              { id: "register", label: session ? "Add Events" : "Sign Up & Register" }
            ].map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.id);
                    setErrorMsg("");
                  }}
                  className={`relative min-h-[44px] rounded-md text-xs font-bold uppercase tracking-wider transition-colors sm:text-sm ${
                    active ? "text-white" : "text-[#4a5a6b]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-tab-pill"
                      className="absolute inset-0 rounded-md bg-[#0d1b2a]"
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-md border-l-4 border-[#b88422] bg-[#fdf5e2] p-3 text-xs text-[#5c400b]">
            <strong>DEMO MODE ONLY.</strong> Use fictional test details. Do not enter real passwords, phone numbers, or make payments.
          </div>

          {errorMsg && (
            <div
              className="mt-4 rounded-md border border-[#ebc2be] bg-[#fceceb] px-3.5 py-2.5 text-sm font-medium text-[#a62b21]"
              role="alert"
            >
              {errorMsg}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLoginSubmit} className="mt-5 grid gap-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold text-[#2b3c4d]">
                  Test Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="cadet@example.test"
                  className="mt-1.5 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3.5 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-bold text-[#2b3c4d]">
                  Demo Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Enter demo password"
                    className="min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3.5 pr-12 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[46px] w-full rounded-md bg-[#d9a742] px-4 py-3 text-sm font-bold text-[#08121e] shadow transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? "Signing in..." : "Log in to My Portal →"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="mt-5 grid gap-4">
              {session ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#bfd4ea] bg-[#eaf2fa] px-3.5 py-2.5 text-xs text-[#164470]">
                  <span>
                    Signed in as <strong>{session.name}</strong> ({session.email})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      Store.logout();
                      window.location.reload();
                    }}
                    className="font-bold underline"
                  >
                    Switch account
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-bold text-[#2b3c4d]">
                      Test Name
                    </label>
                    <input
                      id="reg-name"
                      required
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Demo Cadet"
                      className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-bold text-[#2b3c4d]">
                      Test Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="cadet@example.test"
                      className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-regno" className="block text-xs font-bold text-[#2b3c4d]">
                      Regimental No. (Demo)
                    </label>
                    <input
                      id="reg-regno"
                      value={form.regimentalNo}
                      onChange={(e) => setForm((p) => ({ ...p, regimentalNo: e.target.value }))}
                      placeholder="TN/SD/00/0000"
                      className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-bold text-[#2b3c4d]">
                      Demo Password (6+ chars)
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="reg-password"
                        type={showPass ? "text" : "password"}
                        minLength={6}
                        required
                        value={form.password}
                        onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                        placeholder="6+ characters"
                        className="min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 pr-11 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100"
                        aria-label={showPass ? "Hide password" : "Show password"}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-[#2b3c4d]">Select Event(s)</p>
                <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                  {events.map((ev) => {
                    const checked = selectedEvents.includes(ev.id);
                    const alreadyActive = activeEventIds.has(ev.id);
                    const full = ev.seatsLeft === 0;
                    const disabled = alreadyActive || full;
                    return (
                      <label
                        key={ev.id}
                        className={`flex min-h-[56px] cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                          checked
                            ? "border-[#0d1b2a] bg-[#eef2e6]"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleEvent(ev.id)}
                          className="mt-1 h-4 w-4 accent-[#0d1b2a]"
                        />
                        <span className="text-xs">
                          <strong className="block text-sm text-[#102030]">
                            {ev.title} {ev.subjectToApprovals ? "*" : ""}
                          </strong>
                          <span className="text-[#4a5a6b]">
                            {alreadyActive
                              ? "Already registered"
                              : full
                                ? "Full"
                                : `Day ${ev.day} · ${ev.type} · ${
                                    ev.fee > 0 ? `Demo ₹${ev.fee}` : "Fee TBA"
                                  }`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-[#4a5a6b]">
                  * Firing is strictly subject to approvals.
                </p>
              </div>

              {needsTeamName && (
                <div>
                  <label htmlFor="reg-team" className="block text-xs font-bold text-[#2b3c4d]">
                    Team / Squad Name (Required for Team Events)
                  </label>
                  <input
                    id="reg-team"
                    required
                    value={form.teamName}
                    onChange={(e) => setForm((p) => ({ ...p, teamName: e.target.value }))}
                    placeholder="Alpha Squad"
                    className="mt-1 min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                  />
                </div>
              )}

              <div className="flex items-center justify-between rounded-md border border-[#ead6a5] bg-[#fbf3df] px-4 py-3 text-sm font-bold text-[#102030]">
                <span>Demo Total</span>
                <span>₹{demoTotal}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[46px] w-full rounded-md bg-[#d9a742] px-4 py-3 text-sm font-bold text-[#08121e] shadow transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {submitting
                  ? "Submitting..."
                  : session
                    ? "Add Selected Event(s) →"
                    : "Create Account & Register →"}
              </button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
