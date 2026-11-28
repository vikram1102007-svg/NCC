const DEFAULT_SETTINGS = {
  _id: "event_settings",
  eventName: "NCC Two-Day Event",
  collegeName: "KPR Institute of Engineering and Technology",
  collegeShortName: "KPRIET",
  datesText: "Dates To be announced (Two-Day Format)",
  venueText: "KPRIET Campus & Parade Ground (TBA)",
  contactName: "Associate NCC Officer (To be updated)",
  contactEmail: "ncc@kpriet.ac.in",
  contactPhone: "+91 00000 00000",
  signatoryLeft: "Associate NCC Officer (To be updated)",
  signatoryRight: "Senior Under Officer (To be updated)",
  privacyNoticeText:
    "Your name, regimental number, department, year, phone number, and email are collected solely for KPRIET NCC Two-Day Event enrolment, attendance check-in, and certificate verification."
};

const DEFAULT_EVENTS = [
  {
    _id: "drill",
    title: "Drill",
    day: 1,
    dateText: "Day 1 · Date TBA",
    timeText: "09:30 IST (TBA)",
    venue: "KPRIET Parade Ground (TBA)",
    type: "Team",
    teamSizeLabel: "Squad / Individual",
    capacity: 30,
    registeredCount: 0,
    registrationOpen: true,
    requiresApproval: false,
    statusLabel: "Open",
    description:
      "Precision foot drill and command assessment judged on turnout, uniformity, and parade timing.",
    criteria: [
      "Valid College ID and NCC cadet enrollment verification required on arrival.",
      "Complete NCC uniform turnout, polished footwear, and parade discipline.",
      "Synchronisation, posture, and command clarity during squad inspection."
    ],
    sortOrder: 1
  },
  {
    _id: "quiz",
    title: "NCC & Defence Quiz",
    day: 1,
    dateText: "Day 1 · Date TBA",
    timeText: "13:30 IST (TBA)",
    venue: "KPRIET Auditorium (TBA)",
    type: "Team",
    teamSizeLabel: "Team (2 Cadets)",
    capacity: 40,
    registeredCount: 0,
    registrationOpen: true,
    requiresApproval: false,
    statusLabel: "Open",
    description:
      "Written preliminary round followed by stage finals covering NCC history, Indian defence forces, and current affairs.",
    criteria: [
      "Teams of two cadets from the same unit or institution.",
      "Preliminary written test determines top six teams for stage finals.",
      "Electronic devices are strictly prohibited inside the quiz hall."
    ],
    sortOrder: 2
  },
  {
    _id: "map-reading",
    title: "Map Reading",
    day: 2,
    dateText: "Day 2 · Date TBA",
    timeText: "09:00 IST (TBA)",
    venue: "KPRIET Training Ground (TBA)",
    type: "Individual",
    teamSizeLabel: "Individual / Pair",
    capacity: 35,
    registeredCount: 0,
    registrationOpen: true,
    requiresApproval: false,
    statusLabel: "Open",
    description:
      "Practical field-craft assessment of 6-figure grid references, prismatic compass bearings, and topographic route plotting.",
    criteria: [
      "Accuracy in reading conventional signs and 6-figure grid coordinates.",
      "Compass bearing and back-bearing measurement within allotted time.",
      "Bring basic stationery (pencil, scale, eraser) to the reporting desk."
    ],
    sortOrder: 3
  },
  {
    _id: "obstacle",
    title: "Obstacle Course",
    day: 2,
    dateText: "Day 2 · Date TBA",
    timeText: "11:00 IST (TBA)",
    venue: "KPRIET Obstacle Arena (TBA)",
    type: "Individual",
    teamSizeLabel: "Individual",
    capacity: 40,
    registeredCount: 0,
    registrationOpen: true,
    requiresApproval: false,
    statusLabel: "Open",
    description:
      "Timed physical endurance and agility circuit covering standard cadet obstacles under officer supervision.",
    criteria: [
      "PT kit and proper sports footwear are mandatory for safety.",
      "Clear each obstacle in sequence within the stipulated cut-off time.",
      "Fitness declaration required before starting the circuit."
    ],
    sortOrder: 4
  },
  {
    _id: "firing",
    title: "Firing",
    day: 2,
    dateText: "Day 2 · Date TBA",
    timeText: "14:00 IST (Subject to approvals)",
    venue: "Authorised Range Facility (TBA)",
    type: "Individual",
    teamSizeLabel: "Individual",
    capacity: 25,
    registeredCount: 0,
    registrationOpen: false,
    requiresApproval: true,
    statusLabel: "Subject to approvals",
    description:
      "Proposed range activity. Firing is not confirmed and remains strictly subject to approvals from the organising unit and authorised safety officers.",
    criteria: [
      "Activity is strictly subject to approvals and authorised range safety clearance.",
      "Mandatory range safety briefing and officer supervision before entry.",
      "Zero-tolerance compliance with range discipline and command whistle."
    ],
    sortOrder: 5
  }
];

function sanitizeCsvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text.trimStart()) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function buildRegistrationsCsv(regs, eventsMap = {}) {
  const headers = [
    "Reference",
    "Token",
    "Name",
    "Email",
    "RegimentalNo",
    "Department",
    "Year",
    "Phone",
    "Event",
    "TeamName",
    "Status",
    "Attended",
    "CertificateID",
    "RegisteredAt"
  ];
  const rows = [
    headers,
    ...regs.map((r) => [
      r._id,
      r.token,
      r.participantName,
      r.email,
      r.regimentalNo || "",
      r.department || "",
      r.year || "",
      r.phone || "",
      eventsMap[r.eventId]?.title || r.eventTitle || r.eventId,
      r.teamName || "",
      r.status,
      r.attended ? "Present" : "Absent",
      r.certificateId || "",
      r.createdAt ? new Date(r.createdAt).toISOString() : ""
    ])
  ];
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\r\n");
}

function computeStats(regs, events = []) {
  const active = regs.filter((r) => r.status !== "Cancelled");
  const attended = active.filter((r) => Boolean(r.attended)).length;
  const totalSeatsFilled = events.reduce((sum, ev) => sum + (Number(ev.registeredCount) || 0), 0);
  const totalCapacity = events.reduce((sum, ev) => sum + (Number(ev.capacity) || 0), 0);
  return {
    total: active.length,
    attended,
    cancelled: regs.length - active.length,
    seatsFilled: totalSeatsFilled || active.length,
    totalCapacity
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  DEFAULT_EVENTS,
  sanitizeCsvCell,
  buildRegistrationsCsv,
  computeStats
};
