import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Store } from "../lib/store";
import GlassCard from "../components/GlassCard";

const PENDING_REG_KEY = "ncc_pending_event_selection";

export default function AuthPage({ initialTab = "register", onToast }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselected = params.get("event");
  const isDemo = Store.isDemoMode();

  const [tab, setTab] = useState(initialTab);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmEmailPending, setConfirmEmailPending] = useState("");

  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [myRegs, setMyRegs] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);

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

  const loadData = useCallback(async () => {
    try {
      const [sess, evList] = await Promise.all([Store.getSession(), Store.getEvents()]);
      setSession(sess);
      setEvents(evList);
      if (sess) {
        const regs = await Store.getMyRegistrations();
        setMyRegs(regs);
      } else {
        setMyRegs([]);
      }
    } catch (err) {
      setErrorMsg(err.message || "Could not load registration data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = Store.onAuthStateChange(() => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  const activeEventIds = useMemo(
    () => new Set(myRegs.filter((r) => r.status !== "Cancelled").map((r) => r.eventId)),
    [myRegs]
  );

  const preselectedBlockedEvent = useMemo(() => {
    if (!preselected) return null;
    const found = events.find((e) => e.id === preselected);
    if (found && (!found.registrationOpen || found.subjectToApprovals)) return found;
    return null;
  }, [events, preselected]);

  useEffect(() => {
    if (!preselected || events.length === 0) return;
    const match = events.find(
      (e) =>
        e.id === preselected &&
        e.registrationOpen &&
        !e.subjectToApprovals &&
        e.seatsLeft > 0 &&
        !activeEventIds.has(e.id)
    );
    if (match) {
      setSelectedEvents((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));
    }
  }, [events, preselected, activeEventIds]);

  const needsTeamName = useMemo(
    () =>
      selectedEvents.some((id) => {
        const ev = events.find((e) => e.id === id);
        return ev?.type === "Team";
      }),
    [selectedEvents, events]
  );

  const feeTotal = useMemo(
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
      setErrorMsg("Select at least one open event.");
      return;
    }
    setSubmitting(true);
    try {
      let user = session;
      if (!user) {
        const signupResult = await Store.signup(form);
        if (signupResult.needsEmailConfirmation) {
          try {
            sessionStorage.setItem(
              PENDING_REG_KEY,
              JSON.stringify({ eventIds: selectedEvents, teamName: form.teamName })
            );
          } catch {
            // ignore storage quota
          }
          setConfirmEmailPending(signupResult.email);
          setLoginForm((prev) => ({ ...prev, email: signupResult.email }));
          setTab("login");
          onToast("Check your email inbox to confirm your account before logging in.", "info");
          setSubmitting(false);
          return;
        }
        user = signupResult.session;
      }

      const res = await Store.registerForEvents(user, selectedEvents, form.teamName);
      if (res.added.length === 0 && res.skipped.length > 0) {
        setErrorMsg(`Could not register: ${res.skipped.join(", ")}`);
        setSubmitting(false);
        return;
      }
      try {
        sessionStorage.removeItem(PENDING_REG_KEY);
      } catch {
        // ignore
      }
      onToast(
        `Registered for ${res.added.length} event(s)${isDemo ? " in Demo Mode" : ""}.`,
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
      const loggedUser = await Store.login(loginForm);
      let completedPending = 0;
      try {
        const raw = sessionStorage.getItem(PENDING_REG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.eventIds) && parsed.eventIds.length > 0) {
            const res = await Store.registerForEvents(
              loggedUser,
              parsed.eventIds,
              parsed.teamName || ""
            );
            completedPending = res.added.length;
          }
          sessionStorage.removeItem(PENDING_REG_KEY);
        }
      } catch {
        // Proceed cleanly to portal if pending auto-register hits conflict
      }
      onToast(
        completedPending > 0
          ? `Logged in and registered for ${completedPending} event(s).`
          : "Logged in to Participant Portal.",
        "success"
      );
      navigate("/my");
    } catch (err) {
      setErrorMsg(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!confirmEmailPending) return;
    try {
      await Store.resendSignupEmail(confirmEmailPending);
      onToast(`Verification email resent to ${confirmEmailPending}.`, "success");
    } catch (err) {
      onToast(err.message || "Could not resend email.", "error");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        {/* Desktop Brand Briefing Panel */}
        <aside className="hidden flex-col justify-between rounded-2xl bg-gradient-to-br from-[#08121e] to-[#14283e] p-8 text-white lg:flex">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7bc62]">
              Cadet Enrolment · {isDemo ? "Demo" : "Shared Live Portal"}
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold uppercase">
              NCC Two-Day Event Portal
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Create your account or sign in from any phone to manage registrations, view your opaque-token QR pass, and download attendance certificates.
            </p>
          </div>
          <ul className="grid gap-3 text-sm text-slate-300">
            <li>✓ Synced across mobile &amp; desktop via shared database</li>
            <li>✓ Firing remains strictly subject to approvals</li>
            <li>✓ Duplicate active category submissions prevented</li>
            <li>✓ Zero online payment gateways (offline / demo status only)</li>
          </ul>
        </aside>

        {/* Auth / Registration Card */}
        <GlassCard className="min-w-0">
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
                  className={`relative min-h-[44px] rounded-md px-2 text-[11px] font-bold uppercase tracking-wider transition-colors sm:text-sm ${
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

          {isDemo ? (
            <div className="mt-4 rounded-md border-l-4 border-[#b88422] bg-[#fdf5e2] p-3 text-xs text-[#5c400b]">
              <strong>DEMO MODE ONLY.</strong> Browser-local prototype. Connect Supabase environment keys for multi-device sync.
            </div>
          ) : (
            <div className="mt-4 rounded-md border-l-4 border-[#4b5c34] bg-[#eef2e6] p-3 text-xs text-[#2b3c4d]">
              <strong>Shared Cadet Portal.</strong> Accounts and registrations sync across devices. Event fee payment remains simulated / offline only.
            </div>
          )}

          {preselectedBlockedEvent && (
            <div
              className="mt-4 rounded-md border-l-4 border-[#b88422] bg-[#fdf5e2] p-3 text-xs text-[#5c400b]"
              role="status"
            >
              <strong>{preselectedBlockedEvent.title} registration is not open.</strong> This activity is strictly subject to official approvals.
            </div>
          )}

          {confirmEmailPending && (
            <div className="mt-4 rounded-md border border-[#bcd4bd] bg-[#eef6ee] p-3.5 text-xs text-[#1b5e20]">
              <div className="flex items-start gap-2">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Verify your email to finish sign-in</p>
                  <p className="mt-1">
                    A confirmation link was sent to <strong>{confirmEmailPending}</strong>. Open the link, then log in below to complete your event registration.
                  </p>
                  <button
                    type="button"
                    onClick={handleResend}
                    className="mt-2 font-bold underline"
                  >
                    Resend confirmation email
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              className="mt-4 rounded-md border border-[#ebc2be] bg-[#fceceb] px-3.5 py-2.5 text-sm font-medium text-[#a62b21]"
              role="alert"
            >
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="mt-5 grid gap-3">
              <div className="ncc-skeleton h-12 rounded-md" />
              <div className="ncc-skeleton h-12 rounded-md" />
              <div className="ncc-skeleton h-28 rounded-md" />
            </div>
          ) : tab === "login" ? (
            <form onSubmit={handleLoginSubmit} className="mt-5 grid gap-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold text-[#2b3c4d]">
                  {isDemo ? "Test Email" : "Email Address"}
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="cadet@college.edu"
                  className="mt-1.5 min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3.5 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-bold text-[#2b3c4d]">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Enter your password"
                    className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3.5 pr-12 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
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
                  <span className="min-w-0 break-all">
                    Signed in as <strong>{session.name}</strong> ({session.email})
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await Store.logout();
                      setSession(null);
                      setMyRegs([]);
                      onToast("Signed out.", "info");
                    }}
                    className="min-h-[36px] font-bold underline"
                  >
                    Switch account
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-bold text-[#2b3c4d]">
                      Full Name
                    </label>
                    <input
                      id="reg-name"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Cadet Full Name"
                      className="mt-1 min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-bold text-[#2b3c4d]">
                      Email Address
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="cadet@college.edu"
                      className="mt-1 min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-regno" className="block text-xs font-bold text-[#2b3c4d]">
                      Regimental / Student ID
                    </label>
                    <input
                      id="reg-regno"
                      value={form.regimentalNo}
                      onChange={(e) => setForm((p) => ({ ...p, regimentalNo: e.target.value }))}
                      placeholder="TN/SD/00/0000"
                      className="mt-1 min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-bold text-[#2b3c4d]">
                      Password (6+ chars)
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="reg-password"
                        type={showPass ? "text" : "password"}
                        minLength={6}
                        required
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                        placeholder="6+ characters"
                        className="min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 pr-11 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
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
                    const approvalLocked = !ev.registrationOpen || ev.subjectToApprovals;
                    const full = ev.seatsLeft === 0;
                    const disabled = approvalLocked || alreadyActive || full;
                    return (
                      <label
                        key={ev.id}
                        className={`flex min-h-[56px] min-w-0 items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                          checked
                            ? "border-[#0d1b2a] bg-[#eef2e6]"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleEvent(ev.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-[#0d1b2a]"
                        />
                        <span className="min-w-0 text-xs">
                          <strong className="block text-sm text-[#102030]">
                            {ev.title} {ev.subjectToApprovals ? "*" : ""}
                          </strong>
                          <span className="text-[#4a5a6b]">
                            {approvalLocked
                              ? "Not open (Subject to approvals)"
                              : alreadyActive
                                ? "Already registered"
                                : full
                                  ? "Full"
                                  : `Day ${ev.day} · ${ev.type} · ${ev.seatsLeft} left · ${
                                      ev.fee > 0 ? `₹${ev.fee}` : "Fee TBA"
                                    }`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-[#4a5a6b]">
                  * Firing registration is locked until official unit &amp; safety approvals.
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
                    className="mt-1 min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#0d1b2a] focus:outline-none focus:ring-2 focus:ring-[#d9a742]/40"
                  />
                </div>
              )}

              <div className="flex items-center justify-between rounded-md border border-[#ead6a5] bg-[#fbf3df] px-4 py-3 text-sm font-bold text-[#102030]">
                <span>{isDemo ? "Demo Total" : "Event Fee Total (Placeholder)"}</span>
                <span>₹{feeTotal}</span>
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
