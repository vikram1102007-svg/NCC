const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient } = require("mongodb");

const { createApp } = require("../api/index");
const { setTestDb } = require("../lib/db");
const { hashPassword, generateId } = require("../lib/auth");
const { sanitizeCsvCell, buildRegistrationsCsv } = require("../lib/defaults");

let mongod;
let client;
let db;
let server;
let baseUrl;

async function reqJson(pathname, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}

function extractCookie(res) {
  const setCookie = res.headers.get("set-cookie");
  return setCookie ? setCookie.split(";")[0] : "";
}

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "api-test-secret-minimum-32-characters";
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
  db = client.db("ncc_api_test");
  setTestDb(db);

  const app = createApp({ disableRateLimit: false, authMax: 200, checkinMax: 200 });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (client) await client.close();
  if (mongod) await mongod.stop();
});

test.beforeEach(async () => {
  await db.collection("users").deleteMany({});
  await db.collection("registrations").deleteMany({});
  await db.collection("events").deleteMany({});
  await db.collection("settings").deleteMany({});
  setTestDb(db); // re-triggers ensureIndexesAndDefaults cleanly

  // Trigger DB init + insert one seeded admin account directly (never via browser signup)
  await reqJson("/api/bootstrap");
  const now = new Date();
  await db.collection("users").insertOne({
    _id: generateId("ADM"),
    name: "KPRIET Officer",
    regimentalNo: "ANO-01",
    year: "Staff",
    department: "NCC",
    phone: "9999999999",
    email: "admin@kpriet.ac.in",
    passwordHash: await hashPassword("OfficerStrongPass!99"),
    role: "admin",
    privacyConsent: true,
    privacyConsentAt: now,
    createdAt: now,
    updatedAt: now
  });
});

test("security headers, generic login errors, signup validation, and privilege escalation prevention", async () => {
  const boot = await reqJson("/api/bootstrap");
  assert.equal(boot.status, 200);
  assert.equal(boot.body.settings.collegeName, "KPR Institute of Engineering and Technology");
  assert.ok(boot.headers.get("content-security-policy").includes("https://cdnjs.cloudflare.com"));

  // Reject signup without privacyConsent
  const noConsent = await reqJson("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Cadet One",
      regimentalNo: "TN24A01",
      year: "II Year",
      department: "CSE",
      phone: "9876543210",
      email: "cadet1@kpriet.ac.in",
      password: "Password123",
      privacyConsent: false
    }
  });
  assert.equal(noConsent.status, 400);

  // Even if someone passes role: "admin", server MUST force role: "participant"
  const signup = await reqJson("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Cadet One",
      regimentalNo: "TN24A01",
      year: "II Year",
      department: "CSE",
      phone: "9876543210",
      email: "cadet1@kpriet.ac.in",
      password: "Password123",
      privacyConsent: true,
      role: "admin"
    }
  });
  assert.equal(signup.status, 201);
  assert.equal(signup.body.user.role, "participant");
  const cookieHeader = signup.headers.get("set-cookie");
  assert.match(cookieHeader, /HttpOnly/i);

  // Wrong password & unknown email return identical generic 401 message
  const badPass = await reqJson("/api/auth/login", {
    method: "POST",
    body: { email: "cadet1@kpriet.ac.in", password: "WrongPassword" }
  });
  const badUser = await reqJson("/api/auth/login", {
    method: "POST",
    body: { email: "missing@kpriet.ac.in", password: "WrongPassword" }
  });
  assert.equal(badPass.status, 401);
  assert.equal(badUser.status, 401);
  assert.equal(badPass.body.error, badUser.body.error);
});

test("firing stays locked, duplicate active registration is blocked, and cancellation restores seat", async () => {
  const s1 = await reqJson("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Cadet Two",
      regimentalNo: "TN24A02",
      year: "III Year",
      department: "ECE",
      phone: "9876543211",
      email: "cadet2@kpriet.ac.in",
      password: "Password123",
      privacyConsent: true
    }
  });
  const cookie = extractCookie(s1);

  // Firing must reject
  const firingAttempt = await reqJson("/api/registrations", {
    method: "POST",
    cookie,
    body: { eventIds: ["firing"] }
  });
  assert.equal(firingAttempt.status, 400);
  assert.match(firingAttempt.body.error, /subject to approvals/i);

  // Team event requires team name
  const noTeam = await reqJson("/api/registrations", {
    method: "POST",
    cookie,
    body: { eventIds: ["drill"], teamName: "" }
  });
  assert.equal(noTeam.status, 400);

  // Valid drill registration succeeds
  const reg1 = await reqJson("/api/registrations", {
    method: "POST",
    cookie,
    body: { eventIds: ["drill"], teamName: "KPRIET Alpha" }
  });
  assert.equal(reg1.status, 201);
  const createdReg = reg1.body.registrations[0];
  assert.match(createdReg.token, /^TKN-[A-F0-9]{32}$/);

  // Duplicate active registration blocked
  const dup = await reqJson("/api/registrations", {
    method: "POST",
    cookie,
    body: { eventIds: ["drill"], teamName: "KPRIET Alpha" }
  });
  assert.equal(dup.status, 409);

  // Cancel restores seat and permits re-registering
  const cancelRes = await reqJson(`/api/my/registrations/${createdReg.id}`, {
    method: "DELETE",
    cookie
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.registration.status, "Cancelled");

  const bootAfterCancel = await reqJson("/api/bootstrap");
  const drillAfterCancel = bootAfterCancel.body.events.find((e) => e.id === "drill");
  assert.equal(drillAfterCancel.registeredCount, 0);

  const reReg = await reqJson("/api/registrations", {
    method: "POST",
    cookie,
    body: { eventIds: ["drill"], teamName: "KPRIET Bravo" }
  });
  assert.equal(reReg.status, 201);
});

test("atomic seat limit holds under concurrent requests", async () => {
  await db.collection("events").updateOne({ _id: "obstacle" }, { $set: { capacity: 5 } });

  const cookies = [];
  for (let i = 0; i < 12; i += 1) {
    const s = await reqJson("/api/auth/signup", {
      method: "POST",
      body: {
        name: `Race Cadet ${i}`,
        regimentalNo: `TN24R${i}`,
        year: "II Year",
        department: "MECH",
        phone: `91234560${String(i).padStart(2, "0")}`,
        email: `race${i}@kpriet.ac.in`,
        password: "Password123",
        privacyConsent: true
      }
    });
    cookies.push(extractCookie(s));
  }

  const results = await Promise.all(
    cookies.map((cookie) =>
      reqJson("/api/registrations", {
        method: "POST",
        cookie,
        body: { eventIds: ["obstacle"] }
      })
    )
  );
  const created = results.filter((r) => r.status === 201).length;
  const full = results.filter((r) => r.status === 409).length;
  assert.equal(created, 5);
  assert.equal(full, 7);

  const ev = await db.collection("events").findOne({ _id: "obstacle" });
  assert.equal(ev.registeredCount, 5);
});

test("non-admin gets 403 on all admin routes, QR checkin enforces single-use, CSV neutralises formulas, and password reset works", async () => {
  const s = await reqJson("/api/auth/signup", {
    method: "POST",
    body: {
      name: "=EvilName",
      regimentalNo: "TN24A99",
      year: "IV Year",
      department: "CSE",
      phone: "9876500001",
      email: "student@kpriet.ac.in",
      password: "Password123",
      privacyConsent: true
    }
  });
  const studentCookie = extractCookie(s);
  const studentId = s.body.user.id;

  const regRes = await reqJson("/api/registrations", {
    method: "POST",
    cookie: studentCookie,
    body: { eventIds: ["map-reading"] }
  });
  assert.equal(regRes.status, 201);
  const token = regRes.body.registrations[0].token;
  const regId = regRes.body.registrations[0].id;

  // Non-admin blocked from every admin route with 403
  assert.equal((await reqJson("/api/admin/overview", { cookie: studentCookie })).status, 403);
  assert.equal(
    (await reqJson("/api/admin/checkin", { method: "POST", cookie: studentCookie, body: { token } })).status,
    403
  );
  assert.equal(
    (await reqJson("/api/admin/events", { method: "POST", cookie: studentCookie, body: { title: "X" } })).status,
    403
  );
  assert.equal((await reqJson("/api/admin/export", { cookie: studentCookie })).status, 403);
  assert.equal(
    (await reqJson("/api/admin/settings", { method: "PUT", cookie: studentCookie, body: {} })).status,
    403
  );
  assert.equal(
    (
      await reqJson(`/api/admin/users/${studentId}/reset-password`, {
        method: "POST",
        cookie: studentCookie,
        body: { newPassword: "HackPassword123" }
      })
    ).status,
    403
  );

  // Admin login succeeds
  const adminLogin = await reqJson("/api/auth/login", {
    method: "POST",
    body: { email: "admin@kpriet.ac.in", password: "OfficerStrongPass!99" }
  });
  assert.equal(adminLogin.status, 200);
  const adminCookie = extractCookie(adminLogin);

  // Admin cannot reduce Map Reading capacity below active registration count (1)
  const badCap = await reqJson("/api/admin/events/map-reading", {
    method: "PUT",
    cookie: adminCookie,
    body: {
      title: "Map Reading",
      day: 2,
      capacity: 0,
      type: "Individual"
    }
  });
  assert.equal(badCap.status, 400);

  // Lower limit when setting capacity to 1 succeeds; setting capacity < registeredCount after 2nd reg fails
  await reqJson("/api/admin/events/map-reading", {
    method: "PUT",
    cookie: adminCookie,
    body: { title: "Map Reading", day: 2, capacity: 1, type: "Individual" }
  });

  // Admin QR check-in: invalid token -> 409, valid token -> 200, second scan -> 409 ("Invalid or already used")
  const invalidScan = await reqJson("/api/admin/checkin", {
    method: "POST",
    cookie: adminCookie,
    body: { token: "TKN-DOES-NOT-EXIST" }
  });
  assert.equal(invalidScan.status, 409);
  assert.equal(invalidScan.body.message, "Invalid or already used");

  const validScan = await reqJson("/api/admin/checkin", {
    method: "POST",
    cookie: adminCookie,
    body: { token }
  });
  assert.equal(validScan.status, 200);
  assert.equal(validScan.body.valid, true);
  assert.equal(validScan.body.message, "Valid");
  const certId = validScan.body.registration.certificateId;
  assert.match(certId, /^CERT-/);

  const reusedScan = await reqJson("/api/admin/checkin", {
    method: "POST",
    cookie: adminCookie,
    body: { token }
  });
  assert.equal(reusedScan.status, 409);
  assert.equal(reusedScan.body.message, "Invalid or already used");

  // Student CANNOT cancel after attendance marked present
  const cancelAfterAttend = await reqJson(`/api/my/registrations/${regId}`, {
    method: "DELETE",
    cookie: studentCookie
  });
  assert.equal(cancelAfterAttend.status, 400);

  // Public certificate verification works (and does not expose student email/phone)
  const certRes = await reqJson(`/api/certificates/${certId}`);
  assert.equal(certRes.status, 200);
  assert.equal(certRes.body.certificate.participantName, "=EvilName");
  assert.equal(certRes.body.certificate.email, undefined);

  // Admin CSV export neutralises formula injection
  const csvRes = await reqJson("/api/admin/export", { cookie: adminCookie });
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.body, /"'=EvilName"/);
  assert.equal(sanitizeCsvCell("+1+1"), "\"'+1+1\"");
  assert.match(buildRegistrationsCsv([{ _id: "1", token: "T", participantName: "@cmd", email: "a@b.c", eventId: "drill", status: "Registered" }]), /"'@cmd"/);

  // Admin password reset changes student login password cleanly
  const resetRes = await reqJson(`/api/admin/users/${studentId}/reset-password`, {
    method: "POST",
    cookie: adminCookie,
    body: { newPassword: "ResetPassword999" }
  });
  assert.equal(resetRes.status, 200);
  const oldLogin = await reqJson("/api/auth/login", {
    method: "POST",
    body: { email: "student@kpriet.ac.in", password: "Password123" }
  });
  assert.equal(oldLogin.status, 401);
  const newLogin = await reqJson("/api/auth/login", {
    method: "POST",
    body: { email: "student@kpriet.ac.in", password: "ResetPassword999" }
  });
  assert.equal(newLogin.status, 200);
});

test("rate limiting enforces 429 on repeated auth attempts", async () => {
  const limitedApp = createApp({ authMax: 2 });
  const srv = http.createServer(limitedApp);
  await new Promise((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${srv.address().port}`;
  try {
    for (let i = 0; i < 2; i += 1) {
      await fetch(`${url}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@kpriet.ac.in", password: "wrong" })
      });
    }
    const blocked = await fetch(`${url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@kpriet.ac.in", password: "wrong" })
    });
    assert.equal(blocked.status, 429);
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
});
