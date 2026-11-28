const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { loadEnv } = require("../lib/env");
const { getDb, sanitizeErrorReason, isDbError } = require("../lib/db");
const { buildRegistrationsCsv, computeStats } = require("../lib/defaults");
const {
  hashPassword,
  verifyPassword,
  signSessionToken,
  setAuthCookie,
  clearAuthCookie,
  publicUser,
  generateId,
  generateOpaqueToken,
  resolveSessionUser,
  requireAuth,
  requireAdmin
} = require("../lib/auth");
const {
  cleanStr,
  validateSignupInput,
  validateLoginInput,
  validateRegistrationInput,
  validateEventInput,
  validateSettingsInput
} = require("../lib/validate");

loadEnv();

function formatEvent(ev) {
  const capacity = Number(ev.capacity) || 0;
  const registeredCount = Math.max(0, Number(ev.registeredCount) || 0);
  const isFiring = ev._id === "firing";
  const requiresApproval = isFiring ? true : Boolean(ev.requiresApproval);
  const registrationOpen = isFiring ? false : !requiresApproval && Boolean(ev.registrationOpen);
  return {
    id: String(ev._id),
    title: ev.title,
    day: Number(ev.day) === 2 ? 2 : 1,
    dateText: ev.dateText || `Day ${ev.day} · Date TBA`,
    timeText: ev.timeText || "TBA",
    venue: ev.venue || "TBA",
    type: ev.type === "Team" ? "Team" : "Individual",
    teamSizeLabel: ev.teamSizeLabel || ev.type || "Individual",
    capacity,
    registeredCount,
    seatsLeft: Math.max(0, capacity - registeredCount),
    registrationOpen,
    requiresApproval,
    statusLabel: requiresApproval
      ? "Subject to approvals"
      : registrationOpen
        ? registeredCount >= capacity
          ? "Full"
          : "Open"
        : "Closed",
    description: ev.description || "",
    criteria: Array.isArray(ev.criteria) ? ev.criteria : []
  };
}

function formatRegistration(r) {
  return {
    id: String(r._id),
    token: r.token,
    userId: String(r.userId),
    eventId: String(r.eventId),
    eventTitle: r.eventTitle || String(r.eventId),
    participantName: r.participantName,
    email: r.email,
    regimentalNo: r.regimentalNo || "",
    year: r.year || "",
    department: r.department || "",
    phone: r.phone || "",
    teamName: r.teamName || "",
    status: r.status,
    attended: Boolean(r.attended),
    attendedAt: r.attendedAt || null,
    certificateId: r.certificateId || null,
    createdAt: r.createdAt
  };
}

function createApp(options = {}) {
  const app = express();
  app.set("trust proxy", 1);

  const disableRateLimit =
    options.disableRateLimit === true || process.env.DISABLE_RATE_LIMIT === "true";

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://cdnjs.cloudflare.com",
            "https://cdn.jsdelivr.net"
          ],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );

  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());

  // Prevent browser/CDN caching on dynamic API responses so phones always see live counts.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
  });

  const makeLimiter = (windowMs, max, message) => {
    if (disableRateLimit) {
      return (_req, _res, next) => next();
    }
    return rateLimit({
      windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: message }
    });
  };

  const authLimiter = makeLimiter(
    15 * 60 * 1000,
    options.authMax || 25,
    "Too many attempts from this device. Please wait a few minutes and try again."
  );

  const checkinLimiter = makeLimiter(
    5 * 60 * 1000,
    options.checkinMax || 180,
    "Too many check-in scans. Please slow down and try again."
  );

  // Safe health check (reports connection & event count without exposing secrets)
  app.get("/api/health", async (_req, res) => {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      const eventsCount = await db.collection("events").countDocuments();
      return res.json({ ok: true, db: "connected", events: eventsCount });
    } catch (err) {
      const reason = sanitizeErrorReason(err);
      console.error("[API /api/health]", reason, err?.stack || "");
      return res.status(503).json({ ok: false, db: "error", reason });
    }
  });

  // Public events list (NO PII)
  app.get("/api/events", async (_req, res, next) => {
    try {
      const db = await getDb();
      const eventDocs = await db
        .collection("events")
        .find({})
        .sort({ sortOrder: 1, day: 1, title: 1 })
        .toArray();
      res.json({ events: eventDocs.map(formatEvent) });
    } catch (err) {
      next(err);
    }
  });

  // Public bootstrap: college/event settings + public events with live seats left (NO PII)
  app.get("/api/bootstrap", async (_req, res, next) => {
    try {
      const db = await getDb();
      const [settingsDoc, eventDocs] = await Promise.all([
        db.collection("settings").findOne({ _id: "event_settings" }),
        db.collection("events").find({}).sort({ sortOrder: 1, day: 1, title: 1 }).toArray()
      ]);
      res.json({
        settings: settingsDoc || {},
        events: eventDocs.map(formatEvent)
      });
    } catch (err) {
      next(err);
    }
  });

  // Session inspection
  app.get("/api/auth/me", async (req, res, next) => {
    try {
      const user = await resolveSessionUser(req);
      res.json({ user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  });

  // Participant signup (never allows creating admins from browser)
  app.post("/api/auth/signup", authLimiter, async (req, res, next) => {
    try {
      const { data, error } = validateSignupInput(req.body);
      if (error) return res.status(400).json({ error });

      const db = await getDb();
      const passwordHash = await hashPassword(data.password);
      const now = new Date();
      const userDoc = {
        _id: generateId("USR"),
        name: data.name,
        regimentalNo: data.regimentalNo,
        year: data.year,
        department: data.department,
        phone: data.phone,
        email: data.email,
        passwordHash,
        role: "participant",
        privacyConsent: true,
        privacyConsentAt: now,
        createdAt: now,
        updatedAt: now
      };

      try {
        await db.collection("users").insertOne(userDoc);
      } catch (err) {
        if (err && err.code === 11000) {
          return res.status(409).json({ error: "An account with this email already exists." });
        }
        throw err;
      }

      const token = signSessionToken(userDoc);
      setAuthCookie(req, res, token);
      return res.status(201).json({ user: publicUser(userDoc) });
    } catch (err) {
      return next(err);
    }
  });

  // Login for participants and seeded admins
  app.post("/api/auth/login", authLimiter, async (req, res, next) => {
    try {
      const { data, error } = validateLoginInput(req.body);
      if (error) return res.status(400).json({ error });

      const db = await getDb();
      const user = await db.collection("users").findOne({ email: data.email });
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
      const match = await verifyPassword(data.password, user.passwordHash);
      if (!match) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const token = signSessionToken(user);
      setAuthCookie(req, res, token);
      return res.json({ user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    clearAuthCookie(req, res);
    res.json({ ok: true });
  });

  // Participant's own registrations
  app.get("/api/my/registrations", requireAuth, async (req, res, next) => {
    try {
      const db = await getDb();
      const [regDocs, eventDocs, settingsDoc] = await Promise.all([
        db
          .collection("registrations")
          .find({ userId: String(req.user._id) })
          .sort({ createdAt: -1 })
          .toArray(),
        db.collection("events").find({}).sort({ sortOrder: 1, day: 1, title: 1 }).toArray(),
        db.collection("settings").findOne({ _id: "event_settings" })
      ]);
      res.json({
        registrations: regDocs.map(formatRegistration),
        events: eventDocs.map(formatEvent),
        settings: settingsDoc || {}
      });
    } catch (err) {
      next(err);
    }
  });

  // Atomic event registration (enforces approval lock, team name, seat capacity & 1 active reg per user/event)
  app.post("/api/registrations", requireAuth, async (req, res, next) => {
    try {
      const { data, error } = validateRegistrationInput(req.body);
      if (error) return res.status(400).json({ error });

      const db = await getDb();
      const eventsCol = db.collection("events");
      const regsCol = db.collection("registrations");
      const userId = String(req.user._id);

      const selectedEvents = await eventsCol
        .find({ _id: { $in: data.eventIds } })
        .toArray();

      if (selectedEvents.length !== data.eventIds.length) {
        return res.status(404).json({ error: "One or more selected events were not found." });
      }

      for (const ev of selectedEvents) {
        if (ev._id === "firing" || ev.requiresApproval || !ev.registrationOpen) {
          return res.status(400).json({
            error: `${ev.title} registration is not open (subject to approvals).`
          });
        }
        if (ev.type === "Team" && data.teamName.length < 2) {
          return res.status(400).json({
            error: `Please enter a team or squad name for ${ev.title}.`
          });
        }
      }

      // Fast pre-check before touching counters
      const existingActive = await regsCol.findOne({
        userId,
        eventId: { $in: data.eventIds },
        status: { $ne: "Cancelled" }
      });
      if (existingActive) {
        return res.status(409).json({
          error: `You are already registered for ${existingActive.eventTitle || existingActive.eventId}.`
        });
      }

      const claimed = [];
      const inserted = [];

      const rollbackClaimed = async () => {
        for (const reg of inserted) {
          await regsCol.deleteOne({ _id: reg._id });
        }
        for (const eid of claimed) {
          await eventsCol.updateOne(
            { _id: eid, registeredCount: { $gt: 0 } },
            { $inc: { registeredCount: -1 } }
          );
        }
      };

      for (const ev of selectedEvents) {
        // Single-document atomic seat reservation
        const reserved = await eventsCol.findOneAndUpdate(
          {
            _id: ev._id,
            registrationOpen: true,
            requiresApproval: { $ne: true },
            $expr: { $lt: ["$registeredCount", "$capacity"] }
          },
          { $inc: { registeredCount: 1 } },
          { returnDocument: "after" }
        );

        if (!reserved) {
          await rollbackClaimed();
          return res.status(409).json({
            error: `${ev.title} has reached full capacity or is closed.`
          });
        }
        claimed.push(ev._id);

        const regDoc = {
          _id: generateId("NCC"),
          token: generateOpaqueToken(),
          userId,
          eventId: ev._id,
          eventTitle: ev.title,
          participantName: req.user.name,
          email: req.user.email,
          regimentalNo: req.user.regimentalNo || "",
          year: req.user.year || "",
          department: req.user.department || "",
          phone: req.user.phone || "",
          teamName: ev.type === "Team" ? data.teamName : "",
          status: "Registered",
          active: true,
          attended: false,
          attendedAt: null,
          certificateId: null,
          createdAt: new Date(),
          cancelledAt: null
        };

        try {
          await regsCol.insertOne(regDoc);
          inserted.push(regDoc);
        } catch (err) {
          await eventsCol.updateOne(
            { _id: ev._id, registeredCount: { $gt: 0 } },
            { $inc: { registeredCount: -1 } }
          );
          claimed.pop();
          await rollbackClaimed();

          if (err && err.code === 11000) {
            return res.status(409).json({
              error: `You already have an active registration for ${ev.title}.`
            });
          }
          throw err;
        }
      }

      return res.status(201).json({
        registrations: inserted.map(formatRegistration)
      });
    } catch (err) {
      return next(err);
    }
  });

  // Cancel own registration before attendance is marked
  app.delete("/api/my/registrations/:id", requireAuth, async (req, res, next) => {
    try {
      const regId = cleanStr(req.params.id, 64);
      const userId = String(req.user._id);
      const db = await getDb();
      const regsCol = db.collection("registrations");

      const updated = await regsCol.findOneAndUpdate(
        {
          _id: regId,
          userId,
          status: { $ne: "Cancelled" },
          attended: { $ne: true }
        },
        {
          $set: { status: "Cancelled", active: false, cancelledAt: new Date() }
        },
        { returnDocument: "after" }
      );

      if (!updated) {
        const current = await regsCol.findOne({ _id: regId, userId });
        if (!current) {
          return res.status(404).json({ error: "Registration not found." });
        }
        if (current.attended) {
          return res.status(400).json({
            error: "Cannot cancel a registration after attendance is marked present."
          });
        }
        return res.status(400).json({ error: "Registration is already cancelled." });
      }

      await db.collection("events").updateOne(
        { _id: updated.eventId, registeredCount: { $gt: 0 } },
        { $inc: { registeredCount: -1 } }
      );

      return res.json({ registration: formatRegistration(updated) });
    } catch (err) {
      return next(err);
    }
  });

  // Public single certificate verification (never returns participant list)
  app.get("/api/certificates/:certId", async (req, res, next) => {
    try {
      const certId = cleanStr(req.params.certId, 64).toUpperCase();
      if (!/^CERT-[A-Z0-9-]+$/.test(certId)) {
        return res.status(404).json({ error: "Certificate not found." });
      }
      const db = await getDb();
      const reg = await db.collection("registrations").findOne({
        certificateId: certId,
        attended: true,
        status: { $ne: "Cancelled" }
      });
      if (!reg) {
        return res.status(404).json({ error: "Certificate not found." });
      }

      const [ev, settings] = await Promise.all([
        db.collection("events").findOne({ _id: reg.eventId }),
        db.collection("settings").findOne({ _id: "event_settings" })
      ]);

      return res.json({
        certificate: {
          certificateId: reg.certificateId,
          participantName: reg.participantName,
          regimentalNo: reg.regimentalNo || "N/A",
          department: reg.department || "",
          year: reg.year || "",
          eventTitle: ev?.title || reg.eventTitle || reg.eventId,
          eventDate: ev?.dateText || `Day ${ev?.day || 1}`,
          eventName: settings?.eventName || "NCC Two-Day Event",
          collegeName: settings?.collegeName || "KPR Institute of Engineering and Technology",
          signatoryLeft: settings?.signatoryLeft || "Associate NCC Officer",
          signatoryRight: settings?.signatoryRight || "Senior Under Officer",
          attendedAt: reg.attendedAt || reg.createdAt
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  // ==================== ADMIN ROUTES (403 for non-admins) ====================

  app.get("/api/admin/overview", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const db = await getDb();
      const [settings, eventDocs, regDocs, userDocs] = await Promise.all([
        db.collection("settings").findOne({ _id: "event_settings" }),
        db.collection("events").find({}).sort({ sortOrder: 1, day: 1, title: 1 }).toArray(),
        db.collection("registrations").find({}).sort({ createdAt: -1 }).toArray(),
        db
          .collection("users")
          .find({}, { projection: { passwordHash: 0 } })
          .sort({ createdAt: -1 })
          .toArray()
      ]);

      const events = eventDocs.map(formatEvent);
      const registrations = regDocs.map(formatRegistration);
      res.json({
        settings: settings || {},
        events,
        registrations,
        users: userDocs.map(publicUser),
        stats: computeStats(registrations, events)
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/events", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { data, error } = validateEventInput(req.body);
      if (error) return res.status(400).json({ error });

      const db = await getDb();
      const count = await db.collection("events").countDocuments();
      const doc = {
        ...data,
        registeredCount: 0,
        sortOrder: count + 1,
        updatedAt: new Date()
      };

      try {
        await db.collection("events").insertOne(doc);
      } catch (err) {
        if (err && err.code === 11000) {
          return res.status(409).json({ error: "An event with that ID already exists." });
        }
        throw err;
      }
      return res.status(201).json({ event: formatEvent(doc) });
    } catch (err) {
      return next(err);
    }
  });

  app.put("/api/admin/events/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const id = cleanStr(req.params.id, 64).toLowerCase();
      const db = await getDb();
      const existing = await db.collection("events").findOne({ _id: id });
      if (!existing) return res.status(404).json({ error: "Event not found." });

      const { data, error } = validateEventInput(req.body, id);
      if (error) return res.status(400).json({ error });

      if (data.capacity < (Number(existing.registeredCount) || 0)) {
        return res.status(400).json({
          error: `Cannot reduce capacity below ${existing.registeredCount} already registered participant(s).`
        });
      }

      const updated = await db.collection("events").findOneAndUpdate(
        { _id: id },
        {
          $set: {
            ...data,
            updatedAt: new Date()
          }
        },
        { returnDocument: "after" }
      );
      return res.json({ event: formatEvent(updated) });
    } catch (err) {
      return next(err);
    }
  });

  app.delete("/api/admin/events/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const id = cleanStr(req.params.id, 64).toLowerCase();
      const db = await getDb();
      const existing = await db.collection("events").findOne({ _id: id });
      if (!existing) return res.status(404).json({ error: "Event not found." });

      const activeCount = await db
        .collection("registrations")
        .countDocuments({ eventId: id, status: { $ne: "Cancelled" } });
      if (activeCount > 0) {
        return res.status(400).json({
          error: `Cannot delete ${existing.title} while ${activeCount} active registration(s) exist.`
        });
      }

      await db.collection("events").deleteOne({ _id: id });
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // Single-use QR check-in by opaque token (returns clear Valid vs Invalid or already used)
  app.post("/api/admin/checkin", requireAuth, requireAdmin, checkinLimiter, async (req, res, next) => {
    try {
      const token = cleanStr(req.body?.token, 128).toUpperCase();
      if (!token) {
        return res.status(400).json({
          valid: false,
          status: "invalid_or_used",
          error: "Enter or scan a pass token."
        });
      }

      const db = await getDb();
      const regsCol = db.collection("registrations");
      const now = new Date();
      const newCertId = generateId("CERT");

      const updated = await regsCol.findOneAndUpdate(
        {
          token,
          status: { $ne: "Cancelled" },
          attended: { $ne: true }
        },
        {
          $set: {
            attended: true,
            attendedAt: now,
            status: "Confirmed",
            certificateId: newCertId
          }
        },
        { returnDocument: "after" }
      );

      if (!updated) {
        return res.status(409).json({
          valid: false,
          status: "invalid_or_used",
          message: "Invalid or already used",
          error: "Invalid or already used"
        });
      }

      return res.json({
        valid: true,
        status: "valid",
        message: "Valid",
        registration: formatRegistration(updated)
      });
    } catch (err) {
      return next(err);
    }
  });

  // Manual attendance or status update from Admin roster
  app.patch("/api/admin/registrations/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const regId = cleanStr(req.params.id, 64);
      const db = await getDb();
      const regsCol = db.collection("registrations");
      const eventsCol = db.collection("events");
      const existing = await regsCol.findOne({ _id: regId });
      if (!existing) return res.status(404).json({ error: "Registration not found." });

      const nextStatus =
        req.body?.status && ["Registered", "Confirmed", "Cancelled"].includes(req.body.status)
          ? req.body.status
          : existing.status;

      const hasAttendedUpdate = typeof req.body?.attended === "boolean";
      const nextAttended = hasAttendedUpdate ? req.body.attended : Boolean(existing.attended);

      // Maintain event registeredCount if cancelling or restoring
      if (existing.status !== "Cancelled" && nextStatus === "Cancelled") {
        await eventsCol.updateOne(
          { _id: existing.eventId, registeredCount: { $gt: 0 } },
          { $inc: { registeredCount: -1 } }
        );
      } else if (existing.status === "Cancelled" && nextStatus !== "Cancelled") {
        const reserved = await eventsCol.findOneAndUpdate(
          { _id: existing.eventId, $expr: { $lt: ["$registeredCount", "$capacity"] } },
          { $inc: { registeredCount: 1 } }
        );
        if (!reserved) {
          return res.status(409).json({ error: "Event is at full capacity; cannot restore." });
        }
      }

      const patch = {
        status: nextAttended && nextStatus === "Registered" ? "Confirmed" : nextStatus,
        active: nextStatus !== "Cancelled",
        attended: nextAttended
      };
      if (nextAttended) {
        patch.attendedAt = existing.attendedAt || new Date();
        patch.certificateId = existing.certificateId || generateId("CERT");
      } else if (hasAttendedUpdate && !req.body.attended) {
        patch.attendedAt = null;
      }
      if (patch.status === "Cancelled") {
        patch.cancelledAt = existing.cancelledAt || new Date();
      } else {
        patch.cancelledAt = null;
      }

      const updated = await regsCol.findOneAndUpdate(
        { _id: regId },
        { $set: patch },
        { returnDocument: "after" }
      );
      return res.json({ registration: formatRegistration(updated) });
    } catch (err) {
      return next(err);
    }
  });

  // Admin CSV export with formula-injection neutralization
  app.get("/api/admin/export", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const db = await getDb();
      const [regs, events] = await Promise.all([
        db.collection("registrations").find({}).sort({ createdAt: -1 }).toArray(),
        db.collection("events").find({}).toArray()
      ]);
      const eventsMap = {};
      events.forEach((e) => {
        eventsMap[e._id] = e;
      });
      const csv = buildRegistrationsCsv(regs, eventsMap);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="kpriet-ncc-registrations.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  // Admin settings update
  app.put("/api/admin/settings", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { data, error } = validateSettingsInput(req.body);
      if (error) return res.status(400).json({ error });

      const db = await getDb();
      const updated = await db.collection("settings").findOneAndUpdate(
        { _id: "event_settings" },
        { $set: { ...data, updatedAt: new Date() } },
        { upsert: true, returnDocument: "after" }
      );
      return res.json({ settings: updated });
    } catch (err) {
      return next(err);
    }
  });

  // Admin password reset for participant (no email server required)
  app.post("/api/admin/users/:userId/reset-password", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const userId = cleanStr(req.params.userId, 64);
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
      if (newPassword.length < 6 || newPassword.length > 100) {
        return res.status(400).json({ error: "New password must be 6 to 100 characters." });
      }

      const db = await getDb();
      const target = await db.collection("users").findOne({ _id: userId });
      if (!target) return res.status(404).json({ error: "User not found." });

      const passwordHash = await hashPassword(newPassword);
      await db.collection("users").updateOne(
        { _id: userId },
        { $set: { passwordHash, updatedAt: new Date() } }
      );
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // Generic JSON error handler (logs redacted details to server logs, keeps client generic)
  app.use((err, req, res, _next) => {
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON request body." });
    }
    const safeMsg = String(err?.message || "Unexpected error").replace(
      /mongodb(\+srv)?:\/\/[^\s"'`]+/gi,
      "[REDACTED_URI]"
    );
    const safeStack = String(err?.stack || "").replace(
      /mongodb(\+srv)?:\/\/[^\s"'`]+/gi,
      "[REDACTED_URI]"
    );
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, safeMsg);
    if (safeStack && process.env.NODE_ENV !== "test") {
      console.error(safeStack);
    }
    if (isDbError(err)) {
      return res.status(503).json({
        error: "Database temporarily unavailable. Please check configuration and try again."
      });
    }
    return res.status(500).json({ error: "Service error. Please try again shortly." });
  });

  return app;
}

const app = createApp();
app.createApp = createApp;
module.exports = app;
