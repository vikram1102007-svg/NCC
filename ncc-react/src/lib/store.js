import { supabase } from "./supabaseClient.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";

// Demo Mode fallback keys (only used when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are unset)
const KEYS = {
  events: "ncc_react_events_v1",
  users: "ncc_react_users_v1",
  regs: "ncc_react_regs_v1",
  session: "ncc_react_session_v1",
  admin: "ncc_react_admin_v1",
  settings: "ncc_react_settings_v1",
  certs: "ncc_react_certs_v1"
};

export const DEFAULT_SETTINGS = {
  eventDatesText: "Dates To be announced (Two-Day Format)",
  venueText: "College Parade Ground & Campus Arena (TBA)",
  contactEmail: "ncc-unit@college.example",
  contactPhone: "+91 00000 00000 (Placeholder)",
  signatoryLeft: "ANO / Unit Officer (Placeholder)",
  signatoryRight: "Senior Under Officer / Organiser (Placeholder)"
};

const SEED_EVENTS = [
  {
    id: "drill",
    title: "Drill",
    day: 1,
    time: "09:30 IST (TBA)",
    venue: "College Parade Ground (TBA)",
    type: "Team",
    teamSizeLabel: "Squad / Individual",
    capacity: 30,
    fee: 400,
    statusLabel: "Open",
    registrationOpen: true,
    subjectToApprovals: false,
    description:
      "Precision foot drill and command assessment judged on turnout, uniformity, and parade timing. Final criteria are pending committee review.",
    criteria: [
      "Valid College ID and NCC cadet enrollment verification required on arrival.",
      "Complete NCC uniform turnout, polished footwear, and parade discipline.",
      "Synchronisation, posture, and command clarity during squad inspection."
    ]
  },
  {
    id: "quiz",
    title: "NCC & Defence Quiz",
    day: 1,
    time: "13:30 IST (TBA)",
    venue: "College Auditorium (TBA)",
    type: "Team",
    teamSizeLabel: "Team (2 Cadets)",
    capacity: 40,
    fee: 0,
    statusLabel: "Open",
    registrationOpen: true,
    subjectToApprovals: false,
    description:
      "Written preliminary screening followed by stage finals covering NCC history, Indian defence forces, and current affairs.",
    criteria: [
      "Teams of two cadets from the same unit or institution.",
      "Preliminary written test determines top six teams for stage finals.",
      "Electronic gadgets are strictly prohibited inside the quiz hall."
    ]
  },
  {
    id: "map-reading",
    title: "Map Reading",
    day: 2,
    time: "09:00 IST (TBA)",
    venue: "Training Ground (TBA)",
    type: "Individual",
    teamSizeLabel: "Individual / Pair",
    capacity: 35,
    fee: 0,
    statusLabel: "Open",
    registrationOpen: true,
    subjectToApprovals: false,
    description:
      "Practical field-craft assessment of 6-figure grid references, prismatic compass bearings, and topographic route plotting.",
    criteria: [
      "Accuracy in reading conventional signs and 6-figure grid coordinates.",
      "Compass bearing and back-bearing measurement within allotted time.",
      "Carry basic stationery (pencil, scale, eraser) to the reporting desk."
    ]
  },
  {
    id: "obstacle",
    title: "Obstacle Course",
    day: 2,
    time: "11:00 IST (TBA)",
    venue: "Obstacle Arena (TBA)",
    type: "Individual",
    teamSizeLabel: "Individual",
    capacity: 40,
    fee: 0,
    statusLabel: "Open",
    registrationOpen: true,
    subjectToApprovals: false,
    description:
      "Timed physical endurance and agility circuit covering standard cadet obstacles under officer supervision.",
    criteria: [
      "PT kit and proper sports footwear are mandatory for safety.",
      "Successful clearance of each obstacle in sequence within cut-off time.",
      "Warm-up and fitness declaration required before starting."
    ]
  },
  {
    id: "firing",
    title: "Firing",
    day: 2,
    time: "14:00 IST (Subject to approvals)",
    venue: "Authorised Range Facility (TBA)",
    type: "Individual",
    teamSizeLabel: "Individual",
    capacity: 25,
    fee: 400,
    statusLabel: "Subject to approvals",
    registrationOpen: false,
    subjectToApprovals: true,
    description:
      "Proposed range activity. Firing is not confirmed and remains strictly subject to approvals from the organising unit and authorised safety officers.",
    criteria: [
      "Activity is strictly subject to approvals and authorised range safety clearance.",
      "Mandatory range safety briefing and officer supervision before entry.",
      "Zero-tolerance compliance with range discipline and command whistle."
    ]
  }
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function randomToken(bytesCount = 12) {
  const bytes = new Uint8Array(bytesCount);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function makeId(prefix = "NCC") {
  return `${prefix}-${randomToken(3)}-${Date.now().toString(36).toUpperCase()}`;
}

async function digest(value) {
  const input = String(value ?? "");
  if (globalThis.crypto?.subtle?.digest) {
    const encoded = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return `demo-${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

export function sanitizeCsvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text.trimStart()) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildCsv(regs, eventsMap) {
  const rows = [
    ["Reference", "Token", "Name", "Email", "RegimentalNo", "Event", "TeamName", "Fee", "Status", "Payment", "Attended"],
    ...regs.map((r) => [
      r.id,
      r.qrToken,
      r.name,
      r.email,
      r.regimentalNo || "",
      eventsMap[r.eventId]?.title || r.eventId,
      r.teamName || "",
      r.fee ?? 0,
      r.status,
      r.payment,
      r.attended ? "Present" : "Absent"
    ])
  ];
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\r\n");
}

export function computeStats(regs) {
  const active = regs.filter((r) => r.status !== "Cancelled");
  const paid = active.filter((r) => r.payment === "Demo paid").length;
  const attended = active.filter((r) => Boolean(r.attended)).length;
  return {
    total: active.length,
    paid,
    pending: active.length - paid,
    attended,
    cancelled: regs.length - active.length,
    feeTotal: active.reduce((sum, r) => sum + (Number(r.fee) || 0), 0)
  };
}

function normalizeSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    eventDatesText: row.event_dates_text || DEFAULT_SETTINGS.eventDatesText,
    venueText: row.venue_text || DEFAULT_SETTINGS.venueText,
    contactEmail: row.contact_email || DEFAULT_SETTINGS.contactEmail,
    contactPhone: row.contact_phone || DEFAULT_SETTINGS.contactPhone,
    signatoryLeft: row.signatory_left || DEFAULT_SETTINGS.signatoryLeft,
    signatoryRight: row.signatory_right || DEFAULT_SETTINGS.signatoryRight
  };
}

function normalizeEvent(row, takenMap = {}) {
  const capacity = Math.max(1, Number(row.capacity) || 30);
  const taken = Number(takenMap[row.id] || 0);
  const subjectToApprovals = Boolean(row.subject_to_approvals);
  const registrationOpen = !subjectToApprovals && row.registration_open !== false;
  return {
    id: row.id,
    title: row.title,
    day: Number(row.day) === 2 ? 2 : 1,
    time: row.time || "TBA",
    venue: row.venue || "TBA",
    type: row.type === "Team" ? "Team" : "Individual",
    teamSizeLabel: row.team_size_label || row.type || "Individual",
    capacity,
    fee: Math.max(0, Number(row.fee) || 0),
    statusLabel: row.status_label || (subjectToApprovals ? "Subject to approvals" : "Open"),
    registrationOpen,
    subjectToApprovals,
    description: row.description || "",
    criteria: Array.isArray(row.criteria) ? row.criteria : [],
    taken,
    seatsLeft: Math.max(0, capacity - taken)
  };
}

function normalizeReg(row) {
  return {
    id: row.id,
    qrToken: row.qr_token,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    regimentalNo: row.regimental_no || "",
    eventId: row.event_id,
    teamName: row.team_name || "",
    fee: Number(row.fee) || 0,
    createdAt: row.created_at,
    status: row.status,
    payment: row.payment,
    attended: Boolean(row.attended),
    certificateId: row.certificate_id || null
  };
}

function normalizeCert(row) {
  if (!row) return null;
  return {
    certificateId: row.certificate_id,
    registrationId: row.registration_id,
    participantName: row.participant_name,
    regimentalNo: row.regimental_no || "N/A",
    eventTitle: row.event_title,
    eventDay: row.event_day,
    issuedAt: row.issued_at,
    signatoryLeft: row.signatory_left,
    signatoryRight: row.signatory_right
  };
}

function ensureDemoSeeded() {
  const events = readJson(KEYS.events, null);
  if (!Array.isArray(events) || events.length === 0) {
    writeJson(KEYS.events, SEED_EVENTS);
  }
  const settings = readJson(KEYS.settings, null);
  if (!settings) {
    writeJson(KEYS.settings, DEFAULT_SETTINGS);
  }
}

function buildSlugId(title) {
  const base = String(title || "evt")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return `${base || "evt"}-${randomToken(2).toLowerCase()}`;
}

async function fetchProfileForUser(user) {
  if (!user || !supabase) return null;
  const meta = user.user_metadata || {};
  const { data } = await supabase
    .from("ncc_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (data) {
    return {
      id: data.id,
      name: data.name || meta.name || user.email?.split("@")[0] || "Cadet",
      email: data.email || user.email || "",
      phone: data.phone || meta.phone || "",
      regimentalNo: data.regimental_no || meta.regimentalNo || "",
      department: data.department || meta.department || "",
      year: data.year || meta.year || ""
    };
  }

  return {
    id: user.id,
    name: meta.name || user.email?.split("@")[0] || "Cadet",
    email: user.email || "",
    phone: meta.phone || "",
    regimentalNo: meta.regimentalNo || "",
    department: meta.department || "",
    year: meta.year || ""
  };
}

export const Store = {
  isDemoMode() {
    return !isSupabaseConfigured() || !supabase;
  },

  onAuthStateChange(callback) {
    if (this.isDemoMode()) return () => {};
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session || null);
    });
    return () => subscription.unsubscribe();
  },

  async getSettings() {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase
        .from("ncc_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return normalizeSettings(data);
    }
    ensureDemoSeeded();
    return { ...DEFAULT_SETTINGS, ...readJson(KEYS.settings, {}) };
  },

  async updateSettings(patch) {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase
        .from("ncc_settings")
        .update({
          event_dates_text: String(patch.eventDatesText || "").trim(),
          venue_text: String(patch.venueText || "").trim(),
          contact_email: String(patch.contactEmail || "").trim(),
          contact_phone: String(patch.contactPhone || "").trim(),
          signatory_left: String(patch.signatoryLeft || "").trim(),
          signatory_right: String(patch.signatoryRight || "").trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", 1)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return normalizeSettings(data);
    }
    const next = { ...(await this.getSettings()), ...patch };
    writeJson(KEYS.settings, next);
    return next;
  },

  async getEvents() {
    if (!this.isDemoMode()) {
      const [{ data: eventsData, error: eventsErr }, { data: countsData, error: countsErr }] =
        await Promise.all([
          supabase
            .from("ncc_events")
            .select("*")
            .order("day", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase.rpc("get_event_taken_counts")
        ]);
      if (eventsErr) throw new Error(eventsErr.message);
      if (countsErr) throw new Error(countsErr.message);
      const takenMap = {};
      (countsData || []).forEach((row) => {
        takenMap[row.event_id] = Number(row.taken_count || 0);
      });
      return (eventsData || []).map((row) => normalizeEvent(row, takenMap));
    }

    ensureDemoSeeded();
    const events = readJson(KEYS.events, SEED_EVENTS);
    const regs = readJson(KEYS.regs, []);
    return events.map((ev) => {
      const taken = regs.filter((r) => r.eventId === ev.id && r.status !== "Cancelled").length;
      const subjectToApprovals = Boolean(ev.subjectToApprovals);
      return {
        ...ev,
        subjectToApprovals,
        registrationOpen: !subjectToApprovals && ev.registrationOpen !== false,
        taken,
        seatsLeft: Math.max(0, Number(ev.capacity || 0) - taken)
      };
    });
  },

  async getEventById(id) {
    const events = await this.getEvents();
    return events.find((e) => e.id === id) || null;
  },

  async saveEvent(eventObj) {
    const cleanCriteria = Array.isArray(eventObj.criteria)
      ? eventObj.criteria.filter(Boolean)
      : String(eventObj.criteriaText || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
    const subjectToApprovals = Boolean(eventObj.subjectToApprovals);
    const registrationOpen = !subjectToApprovals && eventObj.registrationOpen !== false;

    if (!this.isDemoMode()) {
      const row = {
        id: eventObj.id || buildSlugId(eventObj.title),
        title: String(eventObj.title || "").trim(),
        day: Number(eventObj.day) === 2 ? 2 : 1,
        time: String(eventObj.time || "TBA").trim(),
        venue: String(eventObj.venue || "TBA").trim(),
        type: eventObj.type === "Team" ? "Team" : "Individual",
        team_size_label: String(
          eventObj.teamSizeLabel || (eventObj.type === "Team" ? "Team" : "Individual")
        ).trim(),
        capacity: Math.max(1, Number(eventObj.capacity) || 30),
        fee: Math.max(0, Number(eventObj.fee) || 0),
        status_label: subjectToApprovals ? "Subject to approvals" : "Open",
        registration_open: registrationOpen,
        subject_to_approvals: subjectToApprovals,
        description: String(eventObj.description || "").trim(),
        criteria: cleanCriteria,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from("ncc_events")
        .upsert(row, { onConflict: "id" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return normalizeEvent(data);
    }

    const events = readJson(KEYS.events, SEED_EVENTS);
    const clean = {
      id: eventObj.id || makeId("EVT").toLowerCase(),
      title: String(eventObj.title || "").trim(),
      day: Number(eventObj.day) === 2 ? 2 : 1,
      time: String(eventObj.time || "TBA").trim(),
      venue: String(eventObj.venue || "TBA").trim(),
      type: eventObj.type === "Team" ? "Team" : "Individual",
      teamSizeLabel: String(
        eventObj.teamSizeLabel || (eventObj.type === "Team" ? "Team" : "Individual")
      ).trim(),
      capacity: Math.max(1, Number(eventObj.capacity) || 30),
      fee: Math.max(0, Number(eventObj.fee) || 0),
      statusLabel: subjectToApprovals ? "Subject to approvals" : "Open",
      registrationOpen,
      subjectToApprovals,
      description: String(eventObj.description || "").trim(),
      criteria: cleanCriteria
    };
    const idx = events.findIndex((e) => e.id === clean.id);
    if (idx >= 0) events[idx] = clean;
    else events.push(clean);
    writeJson(KEYS.events, events);
    return clean;
  },

  async deleteEvent(eventId) {
    if (!this.isDemoMode()) {
      const { error } = await supabase.from("ncc_events").delete().eq("id", eventId);
      if (error) throw new Error(error.message);
      return;
    }
    const events = readJson(KEYS.events, SEED_EVENTS).filter((e) => e.id !== eventId);
    writeJson(KEYS.events, events);
  },

  async getSession() {
    if (!this.isDemoMode()) {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();
      if (error || !session?.user) return null;
      return fetchProfileForUser(session.user);
    }
    return readJson(KEYS.session, null);
  },

  async logout() {
    if (!this.isDemoMode()) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
      return;
    }
    localStorage.removeItem(KEYS.session);
    localStorage.removeItem(KEYS.admin);
  },

  async signup({ name, email, phone, regimentalNo, department, year, password }) {
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPass = String(password || "");
    if (!cleanName || !cleanEmail.includes("@") || cleanPass.length < 6) {
      throw new Error("Enter your name, a valid email, and at least 6 password characters.");
    }

    if (!this.isDemoMode()) {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : undefined;
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPass,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: cleanName,
            phone: String(phone || "").trim(),
            regimentalNo: String(regimentalNo || "").trim(),
            department: String(department || "").trim(),
            year: String(year || "").trim()
          }
        }
      });
      if (error) throw new Error(error.message);
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error("An account with this email already exists. Please log in instead.");
      }

      if (data.session?.user) {
        await supabase.from("ncc_profiles").upsert(
          {
            id: data.session.user.id,
            name: cleanName,
            email: cleanEmail,
            phone: String(phone || "").trim(),
            regimental_no: String(regimentalNo || "").trim(),
            department: String(department || "").trim(),
            year: String(year || "").trim()
          },
          { onConflict: "id" }
        );
        const session = await fetchProfileForUser(data.session.user);
        return { session, needsEmailConfirmation: false, email: cleanEmail };
      }

      return { session: null, needsEmailConfirmation: true, email: cleanEmail };
    }

    const users = readJson(KEYS.users, []);
    if (users.some((u) => u.email === cleanEmail)) {
      throw new Error("An account with this email already exists. Please log in instead.");
    }
    const user = {
      id: makeId("USR"),
      name: cleanName,
      email: cleanEmail,
      phone: String(phone || "").trim(),
      regimentalNo: String(regimentalNo || "").trim(),
      department: String(department || "").trim(),
      year: String(year || "").trim(),
      passwordHash: await digest(cleanPass)
    };
    users.push(user);
    writeJson(KEYS.users, users);
    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      regimentalNo: user.regimentalNo,
      department: user.department,
      year: user.year
    };
    writeJson(KEYS.session, session);
    return { session, needsEmailConfirmation: false, email: cleanEmail };
  },

  async resendSignupEmail(email) {
    if (this.isDemoMode()) return;
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) throw new Error("Enter your email address first.");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail
    });
    if (error) throw new Error(error.message);
  },

  async login({ email, password }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPass = String(password || "");
    if (!cleanEmail || !cleanPass) {
      throw new Error("Enter both email and password.");
    }

    if (!this.isDemoMode()) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass
      });
      if (error) throw new Error(error.message);
      return fetchProfileForUser(data.user);
    }

    const hash = await digest(cleanPass);
    const user = readJson(KEYS.users, []).find((u) => u.email === cleanEmail && u.passwordHash === hash);
    if (!user) {
      throw new Error("Demo email or password did not match.");
    }
    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      regimentalNo: user.regimentalNo || "",
      department: user.department || "",
      year: user.year || ""
    };
    writeJson(KEYS.session, session);
    return session;
  },

  async registerForEvents(user, eventIds, teamName = "") {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase.rpc("register_for_ncc_events", {
        p_event_ids: eventIds,
        p_team_name: String(teamName || "").trim()
      });
      if (error) throw new Error(error.message);
      return { added: (data || []).map(normalizeReg), skipped: [] };
    }

    const all = readJson(KEYS.regs, []);
    const events = await this.getEvents();
    const added = [];
    const skipped = [];

    for (const eventId of eventIds) {
      const ev = events.find((e) => e.id === eventId);
      if (!ev) continue;
      if (!ev.registrationOpen || ev.subjectToApprovals) {
        throw new Error(`${ev.title} registration is not open (subject to approvals).`);
      }

      const duplicate = all.some(
        (r) => r.userId === user.id && r.eventId === eventId && r.status !== "Cancelled"
      );
      if (duplicate) {
        skipped.push(`${ev.title} (already active)`);
        continue;
      }

      const activeCount = all.filter((r) => r.eventId === eventId && r.status !== "Cancelled").length;
      if (activeCount >= ev.capacity) {
        skipped.push(`${ev.title} (full)`);
        continue;
      }

      if (ev.type === "Team" && !String(teamName || "").trim()) {
        throw new Error(`Please enter a team / squad name for ${ev.title}.`);
      }

      const reg = {
        id: makeId("NCC"),
        qrToken: `TKN-${randomToken(8)}`,
        userId: user.id,
        name: user.name,
        email: user.email,
        regimentalNo: user.regimentalNo || "",
        eventId: ev.id,
        teamName: ev.type === "Team" ? String(teamName || "").trim() : "",
        fee: Number(ev.fee) || 0,
        createdAt: new Date().toISOString(),
        status: "Registered",
        payment: Number(ev.fee) > 0 ? "Demo pending" : "No fee (TBA)",
        attended: false,
        certificateId: null
      };
      all.push(reg);
      added.push(reg);
    }

    writeJson(KEYS.regs, all);
    return { added, skipped };
  },

  async getMyRegistrations() {
    if (!this.isDemoMode()) {
      const session = await this.getSession();
      if (!session) return [];
      const { data, error } = await supabase
        .from("ncc_registrations")
        .select("*")
        .eq("user_id", session.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(normalizeReg);
    }

    const s = await this.getSession();
    if (!s) return [];
    return readJson(KEYS.regs, []).filter((r) => r.userId === s.id);
  },

  async cancelRegistration(regId) {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase.rpc("cancel_my_registration", {
        p_reg_id: regId
      });
      if (error) throw new Error(error.message);
      return normalizeReg(data);
    }

    const s = await this.getSession();
    if (!s) throw new Error("Please log in first.");
    const all = readJson(KEYS.regs, []);
    const target = all.find((r) => r.id === regId && r.userId === s.id);
    if (!target) throw new Error("Registration not found.");
    target.status = "Cancelled";
    writeJson(KEYS.regs, all);
    return target;
  },

  async simulatePayment(regId) {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase.rpc("simulate_my_demo_payment", {
        p_reg_id: regId
      });
      if (error) throw new Error(error.message);
      return normalizeReg(data);
    }

    const s = await this.getSession();
    if (!s) throw new Error("Please log in first.");
    const all = readJson(KEYS.regs, []);
    const target = all.find((r) => r.id === regId && r.userId === s.id && r.status !== "Cancelled");
    if (!target) throw new Error("Active registration not found.");
    target.payment = "Demo paid";
    writeJson(KEYS.regs, all);
    return target;
  },

  async isAdmin() {
    if (!this.isDemoMode()) {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session?.user) return false;
      const { data, error } = await supabase.rpc("is_ncc_admin");
      if (error) return false;
      return Boolean(data);
    }
    return Boolean(readJson(KEYS.admin, false));
  },

  async adminLogin({ email, password }) {
    if (!this.isDemoMode()) {
      const cleanEmail = String(email || "").trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: String(password || "")
      });
      if (error) throw new Error(error.message);
      const allowed = await this.isAdmin();
      if (!allowed) {
        await supabase.auth.signOut();
        throw new Error(
          "Access denied: this account does not have Organiser / Admin role in the database."
        );
      }
      return true;
    }

    if (String(email).trim() === "admin@ncc.test" && String(password) === "NCCDemo400") {
      writeJson(KEYS.admin, true);
      return true;
    }
    throw new Error("Admin demo credentials did not match.");
  },

  async getAllRegistrations() {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase
        .from("ncc_registrations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(normalizeReg);
    }
    return readJson(KEYS.regs, []);
  },

  async updateRegistration(regId, patch) {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase.rpc("admin_update_registration", {
        p_reg_id: regId,
        p_status: patch.status ?? null,
        p_payment: patch.payment ?? null,
        p_attended: typeof patch.attended === "boolean" ? patch.attended : null
      });
      if (error) throw new Error(error.message);
      return normalizeReg(data);
    }

    const all = readJson(KEYS.regs, []);
    const target = all.find((r) => r.id === regId);
    if (!target) throw new Error("Registration not found.");
    Object.assign(target, patch);
    if (target.attended && !target.certificateId) {
      target.certificateId = makeId("CERT");
      await this.recordCertificate(target);
    }
    writeJson(KEYS.regs, all);
    return target;
  },

  async checkInByToken(token) {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase.rpc("admin_checkin_by_token", {
        p_token: String(token || "").trim()
      });
      if (error) throw new Error(error.message);
      return normalizeReg(data);
    }

    const clean = String(token || "").trim().toUpperCase();
    if (!clean) throw new Error("Enter a QR pass token or reference ID.");
    const all = readJson(KEYS.regs, []);
    const target = all.find(
      (r) =>
        (r.qrToken.toUpperCase() === clean || r.id.toUpperCase() === clean) &&
        r.status !== "Cancelled"
    );
    if (!target) throw new Error("No active registration matches that token.");
    return this.updateRegistration(target.id, { attended: true, status: "Confirmed" });
  },

  async deleteRegistration(regId) {
    if (!this.isDemoMode()) {
      const { error } = await supabase.from("ncc_registrations").delete().eq("id", regId);
      if (error) throw new Error(error.message);
      return;
    }
    const all = readJson(KEYS.regs, []).filter((r) => r.id !== regId);
    writeJson(KEYS.regs, all);
  },

  async recordCertificate(reg) {
    if (!this.isDemoMode()) {
      return this.ensureCertificateForReg(reg.id);
    }
    const certs = readJson(KEYS.certs, {});
    const ev = await this.getEventById(reg.eventId);
    const settings = await this.getSettings();
    certs[reg.certificateId] = {
      certificateId: reg.certificateId,
      participantName: reg.name,
      regimentalNo: reg.regimentalNo || "N/A",
      eventTitle: ev?.title || reg.eventId,
      eventDay: ev ? `Day ${ev.day}` : "Event Day",
      issuedAt: new Date().toISOString(),
      signatoryLeft: settings.signatoryLeft,
      signatoryRight: settings.signatoryRight
    };
    writeJson(KEYS.certs, certs);
    return certs[reg.certificateId];
  },

  async ensureCertificateForReg(regId) {
    if (!this.isDemoMode()) {
      const { data, error } = await supabase
        .from("ncc_certificates")
        .select("*")
        .eq("registration_id", regId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error("Certificates are available only after attendance is marked present.");
      }
      return normalizeCert(data);
    }

    const all = readJson(KEYS.regs, []);
    const reg = all.find((r) => r.id === regId);
    if (!reg || !reg.attended || reg.status === "Cancelled") {
      throw new Error("Certificates are available only after attendance is marked present.");
    }
    if (!reg.certificateId) {
      reg.certificateId = makeId("CERT");
      writeJson(KEYS.regs, all);
    }
    return this.recordCertificate(reg);
  },

  async getCertificateById(certId) {
    const clean = String(certId || "").trim().toUpperCase();
    if (!clean) return null;
    if (!this.isDemoMode()) {
      const { data, error } = await supabase.rpc("verify_ncc_certificate", {
        p_cert_id: clean
      });
      if (error) throw new Error(error.message);
      return data?.[0] ? normalizeCert(data[0]) : null;
    }
    const certs = readJson(KEYS.certs, {});
    return certs[clean] || null;
  }
};
