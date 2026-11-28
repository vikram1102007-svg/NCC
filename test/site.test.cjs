const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { escapeHtml, sanitizeCsvCell, buildCsv, computeStats } = require("../ncc.js");

const root = path.resolve(__dirname, "..");

function readPage(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

test("all main HTML pages exist, brand KPRIET cleanly, and have no demo or payment leftovers", () => {
  const pages = [
    "index.html",
    "events.html",
    "event.html",
    "register.html",
    "login.html",
    "participant.html",
    "admin.html",
    "certificate.html",
    "404.html"
  ];
  assert.equal(fs.existsSync(path.join(root, "payment.html")), false, "payment.html must be removed");

  for (const page of pages) {
    const html = readPage(page);
    assert.match(html, /KPR Institute of Engineering and Technology/i, `${page} must include KPRIET`);
    assert.match(html, /meta name="viewport"/i, `${page} must include viewport meta`);
    assert.doesNotMatch(html, /admin@ncc\.test|NCCDemo400/i, `${page} must not embed demo credentials`);
    assert.doesNotMatch(html, /DEMO MODE ONLY|Simulate payment|payment\.html/i, `${page} must not have demo/payment UI`);
    assert.doesNotMatch(html, /\sonclick=|\sonsubmit=|\sonchange=/i, `${page} must avoid inline event handlers for CSP`);
  }
});

test("frontend scripts remove localStorage data storage and handle errors gracefully", () => {
  const nccJs = readPage("ncc.js");
  const uiJs = readPage("scripts/ui.js");
  assert.doesNotMatch(
    nccJs,
    /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)/i,
    "ncc.js must not store data in localStorage/sessionStorage"
  );
  assert.doesNotMatch(
    uiJs,
    /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)/i,
    "scripts/ui.js must not read localStorage"
  );
  assert.match(uiJs, /addEventListener\(["']error["']/, "Global error handler missing");
  assert.match(uiJs, /addEventListener\(["']unhandledrejection["']/, "Global unhandledrejection handler missing");
  assert.match(uiJs, /Reload Page/, "Friendly reload button missing in fallback error card");
  assert.match(nccJs, /E-API-/, "Short error code formatting missing in apiJson");

  const css = fs.readFileSync(path.join(root, "assets/styles.css"), "utf8");
  assert.match(css, /\.logo-slot\s*\{[\s\S]*flex-shrink:\s*0/, "logo-slot must enforce flex-shrink: 0");
  assert.doesNotMatch(readPage("index.html"), /KPRIET Logo|College Logo Slot/, "Logo slots must not render overlapping placeholder text");
});

test("register, participant, admin, and certificate pages include required production fields and pinned CDNs", () => {
  const reg = readPage("register.html");
  assert.match(reg, /name="regimentalNo"/);
  assert.match(reg, /name="year"/);
  assert.match(reg, /name="department"/);
  assert.match(reg, /name="phone"/);
  assert.match(reg, /name="privacyConsent"/);

  const part = readPage("participant.html");
  assert.match(part, /qrcode-generator@1\.4\.4\/qrcode\.min\.js/);
  assert.match(part, /jspdf\/2\.5\.2\/jspdf\.umd\.min\.js/);

  const admin = readPage("admin.html");
  assert.match(admin, /html5-qrcode@2\.3\.8\/html5-qrcode\.min\.js/);
  assert.doesNotMatch(admin, /value="admin@/i, "Admin email must never be pre-filled");
});

test("firing stays locked in defaults and vercel.json defines relative rewrites and CSP headers", () => {
  const { DEFAULT_EVENTS } = require("../lib/defaults");
  const firing = DEFAULT_EVENTS.find((e) => e._id === "firing");
  assert.ok(firing);
  assert.equal(firing.requiresApproval, true);
  assert.equal(firing.registrationOpen, false);
  assert.match(firing.statusLabel, /subject to approvals/i);

  const vercel = JSON.parse(readPage("vercel.json"));
  assert.ok(Array.isArray(vercel.rewrites));
  assert.ok(vercel.rewrites.some((r) => r.source === "/api/(.*)" && r.destination === "/api/index.js"));
  for (const r of vercel.rewrites) {
    assert.ok(r.destination.startsWith("/"), `Rewrite destination ${r.destination} must be relative`);
  }
});

test("ncc.js escapes HTML, neutralises CSV formula prefixes, and computes stats cleanly", () => {
  assert.equal(escapeHtml('<script>"\'&'), "&lt;script&gt;&quot;&#39;&amp;");
  assert.equal(sanitizeCsvCell("=CMD()"), "\"'=CMD()\"");
  assert.equal(sanitizeCsvCell("+SUM()"), "\"'+SUM()\"");
  assert.equal(sanitizeCsvCell("-1+1"), "\"'-1+1\"");
  assert.equal(sanitizeCsvCell("@2+2"), "\"'@2+2\"");
  const csv = buildCsv(
    [
      {
        id: "NCC-1",
        token: "TKN-ABC",
        participantName: "=Formula",
        email: "a@b.c",
        eventId: "drill",
        status: "Registered",
        attended: true
      }
    ],
    { drill: { title: "Drill" } }
  );
  assert.match(csv, /"'=Formula"/);
  assert.match(csv, /"Present"/);

  const stats = computeStats(
    [
      { status: "Registered", attended: false },
      { status: "Confirmed", attended: true },
      { status: "Cancelled", attended: false }
    ],
    [{ capacity: 30, registeredCount: 2 }]
  );
  assert.deepEqual(stats, {
    total: 2,
    attended: 1,
    cancelled: 1,
    seatsFilled: 2,
    totalCapacity: 30
  });
});
