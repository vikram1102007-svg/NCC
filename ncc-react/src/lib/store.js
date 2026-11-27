import { isSupabaseConfigured } from "./supabaseConfig.js";

// Demo Mode storage keys (isolated from any live Supabase data)
const KEYS = {
  events: "ncc_react_events_v1",
  users: "ncc_react_users_v1",
  regs: "ncc_react_regs_v1",
  session: "ncc_react_session_v1",
  admin: "ncc_react_admin_v1",
  settings: "ncc_react_settings_v1",
  certs: "ncc_react_certs_v1"
};

const DEFAULT_SETTINGS = {
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
    statusLabel: "Demo Open",
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
    statusLabel: "Demo Open",
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
    statusLabel: "Demo Open",
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
    statusLabel: "Demo Open",
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

function ensureSeeded() {
  const events = readJson(KEYS.events, null);
  if (!Array.isArray(events) || events.length === 0) {
    writeJson(KEYS.events, SEED_EVENTS);
  }
  const settings = readJson(KEYS.settings, null);
  if (!settings) {
    writeJson(KEYS.settings, DEFAULT_SETTINGS);
  }
}

export const Store = {
  isDemoMode() {
    return !isSupabaseConfigured();
  },

  getSettings() {
    ensureSeeded();
    return { ...DEFAULT_SETTINGS, ...readJson(KEYS.settings, {}) };
  },

  updateSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    writeJson(KEYS.settings, next);
    return next;
  },

  getEvents() {
    ensureSeeded();
    const events = readJson(KEYS.events, SEED_EVENTS);
    const regs = readJson(KEYS.regs, []);
    return events.map((ev) => {
      const taken = regs.filter((r) => r.eventId === ev.id && r.status !== "Cancelled").length;
      return {
        ...ev,
        taken,
        seatsLeft: Math.max(0, Number(ev.capacity || 0) - taken)
      };
    });
  },

  getEventById(id) {
    return this.getEvents().find((e) => e.id === id) || null;
  },

  saveEvent(eventObj) {
    const events = readJson(KEYS.events, SEED_EVENTS);
    const clean = {
      id: eventObj.id || makeId("EVT").toLowerCase(),
      title: String(eventObj.title || "").trim(),
      day: Number(eventObj.day) === 2 ? 2 : 1,
      time: String(eventObj.time || "TBA").trim(),
      venue: String(eventObj.venue || "TBA").trim(),
      type: eventObj.type === "Team" ? "Team" : "Individual",
      teamSizeLabel: String(eventObj.teamSizeLabel || (eventObj.type === "Team" ? "Team" : "Individual")).trim(),
      capacity: Math.max(1, Number(eventObj.capacity) || 30),
      fee: Math.max(0, Number(eventObj.fee) || 0),
      statusLabel: String(eventObj.statusLabel || "Demo Open").trim(),
      subjectToApprovals: Boolean(eventObj.subjectToApprovals),
      description: String(eventObj.description || "").trim(),
      criteria: Array.isArray(eventObj.criteria)
        ? eventObj.criteria.filter(Boolean)
        : String(eventObj.criteriaText || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
    };
    const idx = events.findIndex((e) => e.id === clean.id);
    if (idx >= 0) events[idx] = clean;
    else events.push(clean);
    writeJson(KEYS.events, events);
    return clean;
  },

  deleteEvent(eventId) {
    const events = readJson(KEYS.events, SEED_EVENTS).filter((e) => e.id !== eventId);
    writeJson(KEYS.events, events);
  },

  getSession() {
    return readJson(KEYS.session, null);
  },

  logout() {
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
    return session;
  },

  async login({ email, password }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const hash = await digest(String(password || ""));
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

  registerForEvents(user, eventIds, teamName = "") {
    const all = readJson(KEYS.regs, []);
    const events = this.getEvents();
    const added = [];
    const skipped = [];

    for (const eventId of eventIds) {
      const ev = events.find((e) => e.id === eventId);
      if (!ev) continue;

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
        qrToken: `TKN-${randomToken(8)}`, // Opaque random token only — never stores PII
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

  getMyRegistrations() {
    const s = this.getSession();
    if (!s) return [];
    return readJson(KEYS.regs, []).filter((r) => r.userId === s.id);
  },

  cancelRegistration(regId) {
    const s = this.getSession();
    if (!s) throw new Error("Please log in first.");
    const all = readJson(KEYS.regs, []);
    const target = all.find((r) => r.id === regId && r.userId === s.id);
    if (!target) throw new Error("Registration not found.");
    target.status = "Cancelled";
    writeJson(KEYS.regs, all);
    return target;
  },

  simulatePayment(regId) {
    const s = this.getSession();
    if (!s) throw new Error("Please log in first.");
    const all = readJson(KEYS.regs, []);
    const target = all.find((r) => r.id === regId && r.userId === s.id && r.status !== "Cancelled");
    if (!target) throw new Error("Active registration not found.");
    target.payment = "Demo paid";
    writeJson(KEYS.regs, all);
    return target;
  },

  isAdmin() {
    return Boolean(readJson(KEYS.admin, false));
  },

  adminLogin({ email, password }) {
    if (String(email).trim() === "admin@ncc.test" && String(password) === "NCCDemo400") {
      writeJson(KEYS.admin, true);
      return true;
    }
    throw new Error("Admin demo credentials did not match.");
  },

  getAllRegistrations() {
    return readJson(KEYS.regs, []);
  },

  updateRegistration(regId, patch) {
    const all = readJson(KEYS.regs, []);
    const target = all.find((r) => r.id === regId);
    if (!target) throw new Error("Registration not found.");
    Object.assign(target, patch);

    // Issue deterministic certificate record when marked attended
    if (target.attended && !target.certificateId) {
      target.certificateId = makeId("CERT");
      this.recordCertificate(target);
    }
    writeJson(KEYS.regs, all);
    return target;
  },

  checkInByToken(token) {
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

  deleteRegistration(regId) {
    const all = readJson(KEYS.regs, []).filter((r) => r.id !== regId);
    writeJson(KEYS.regs, all);
  },

  recordCertificate(reg) {
    const certs = readJson(KEYS.certs, {});
    const ev = this.getEventById(reg.eventId);
    const settings = this.getSettings();
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

  ensureCertificateForReg(regId) {
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

  getCertificateById(certId) {
    const clean = String(certId || "").trim().toUpperCase();
    if (!clean) return null;
    const certs = readJson(KEYS.certs, {});
    return certs[clean] || null;
  }
};
