const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = read("index.html");
const events = read("events.html");
const register = read("register.html");
const login = read("login.html");
const admin = read("admin.html");
const participant = read("participant.html");
const payment = read("payment.html");
const app = read("ncc.js");
const css = read("assets/styles.css");
const uiScript = read("scripts/ui.js");
const demoHelpers = require("../ncc.js");

test("public home has accessible document basics and a two-day event title", () => {
  assert.match(home, /<html lang="en">/i);
  assert.match(home, /<meta name="viewport" content="width=device-width,initial-scale=1">/i);
  assert.match(home, /<title>[^<]+<\/title>/i);
  assert.match(home, /<header\b/i);
  assert.match(home, /<nav\b/i);
  assert.match(home, /<main\b/i);
  assert.match(home, /<footer\b/i);
  assert.equal((home.match(/<h1\b/gi) || []).length, 1);
  assert.match(home, /two-day/i);
});

test("navigation targets and linked local pages exist across all pages", () => {
  for (const page of [home, events, register, login, participant, payment, admin]) {
    const links = [...page.matchAll(/href="([^"]+\.html(?:#|\?)?[^"]*)"/g)].map(
      (m) => m[1].split("#")[0].split("?")[0]
    );
    assert.ok(links.length >= 3);
    for (const link of links) {
      assert.ok(fs.existsSync(path.join(root, link)), "missing linked page: " + link);
    }
  }
});

test("event details use pending placeholders rather than invented official dates", () => {
  const pages = home + events;
  assert.match(pages, /Dates/i);
  assert.match(pages, /To be announced|TBA|pending organiser confirmation/i);
  assert.match(pages, /Drill/i);
  assert.match(pages, /Firing/i);
  assert.match(pages, /approval/i);
  assert.match(pages, /fee.{0,30}(?:TBA|announced|pending)/i);
});

test("demo registration, login and participant pages have accessible forms and demo notices", () => {
  assert.match(register, /DEMO MODE ONLY/i);
  assert.match(register, /<form id="register-form">/);
  assert.match(register, /for="reg-name"/);
  assert.match(register, /id="reg-name"/);
  assert.match(register, /for="reg-email"/);
  assert.match(register, /id="reg-password"/);
  assert.match(login, /DEMO MODE ONLY/i);
  assert.match(login, /<form id="login-form">/);
  assert.match(login, /for="login-email"/);
  assert.match(login, /for="login-password"/);
  assert.match(participant, /DEMO MODE ONLY/i);
  assert.match(participant, /id="my-registrations"/);
  assert.match(participant, /data-logout/);
});

test("admin demo page has clear demo-only labels, accessible controls and confirmation", () => {
  assert.match(admin, /DEMO MODE ONLY/i);
  assert.match(admin, /<form id="admin-form">/);
  assert.match(admin, /for="admin-email"/);
  assert.match(admin, /for="admin-password"/);
  assert.match(admin, /id="admin-export"/);
  assert.match(admin, /id="admin-search"/);
  assert.match(app, /confirmAction\(|window\.confirm\(/);
  assert.match(uiScript, /confirmModal/);
});

test("payment simulation page stays strictly demo-only with no UPI QR or gateway", () => {
  assert.match(payment, /DEMO MODE ONLY/i);
  assert.match(payment, /No real payment is possible here/i);
  assert.match(payment, /id="simulate-payment"/);
  assert.doesNotMatch(payment, /ncc-demo@upi|<img\b|upi:/i);
});

test("ncc.js escapes HTML, neutralises CSV formula injection and excludes cancelled stats", () => {
  assert.equal(
    demoHelpers.escapeHtml('<script>alert("xss")</script>&\'test\''),
    "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&#39;test&#39;"
  );
  assert.equal(demoHelpers.sanitizeCsvCell("=CMD()"), "\"'=CMD()\"");
  assert.equal(demoHelpers.sanitizeCsvCell("+123"), "\"'+123\"");
  assert.equal(demoHelpers.sanitizeCsvCell("-123"), "\"'-123\"");
  assert.equal(demoHelpers.sanitizeCsvCell("@SUM(A1)"), "\"'@SUM(A1)\"");
  assert.equal(demoHelpers.sanitizeCsvCell("  =1+1"), "\"'  =1+1\"");
  assert.equal(demoHelpers.sanitizeCsvCell('Cadet "A"'), '"Cadet ""A"""');

  const csv = demoHelpers.buildCsv([
    {
      id: "NCC-1",
      name: "=Evil",
      email: "a@b.test",
      event: "firing",
      fee: 400,
      status: "Registered",
      payment: "Demo pending"
    }
  ]);
  assert.match(csv, /^"Reference","Name","Email","Event","Fee","Status","Payment"/);
  assert.match(csv, /"'=Evil"/);

  const stats = demoHelpers.computeStats([
    { status: "Registered", payment: "Demo pending", fee: 400 },
    { status: "Confirmed", payment: "Demo paid", fee: 400 },
    { status: "Cancelled", payment: "Demo pending", fee: 400 }
  ]);
  assert.deepEqual(stats, {
    total: 2,
    paid: 1,
    pending: 1,
    cancelled: 1,
    feeTotal: 800
  });
});

test("stylesheet includes responsive, focus-visible and reduced-motion support", () => {
  assert.match(css, /@media/i);
  assert.match(css, /focus-visible/i);
  assert.match(css, /prefers-reduced-motion/i);
});
