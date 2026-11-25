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
const css = read("ncc.css");

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

test("navigation targets and linked local pages exist", () => {
  const links = [...home.matchAll(/href="([^"]+\.html(?:#[^"]*)?)"/g)].map((m) => m[1].split("#")[0]);
  assert.ok(links.length >= 3);
  for (const link of links) {
    assert.ok(fs.existsSync(path.join(root, link)), "missing linked page: " + link);
  }
});

test("event details use pending placeholders rather than invented fees or dates", () => {
  const pages = home + events;
  assert.match(pages, /Dates[^<]*|Dates/i);
  assert.match(pages, /To be announced|TBA|pending organiser confirmation/i);
  assert.match(pages, /Drill/i);
  assert.match(pages, /Firing/i);
  assert.match(pages, /approval/i);
  assert.doesNotMatch(pages, /₹\s*400|INR\s*400/i);
  assert.match(pages, /fee.{0,30}(?:TBA|announced|pending)/i);
});

test("registration and participant portals are gated until secure backend setup", () => {
  assert.match(register, /Registration is not open/i);
  assert.match(register, /does not collect/i);
  assert.doesNotMatch(register, /<form\b|type="password"|name="phone"/i);
  assert.match(login, /Login coming soon/i);
  assert.doesNotMatch(login, /<form\b|type="password"/i);
  assert.match(participant, /tracking coming soon/i);
  assert.doesNotMatch(participant, /localStorage\\.(?:getItem|setItem)|<form\\b/i);
});

test("admin access has no hardcoded demo credentials or client-side data manager", () => {
  assert.match(admin, /Admin portal is not enabled/i);
  assert.doesNotMatch(admin, /admin@ncc\.test|NCCDemo400|<form\b/i);
  assert.doesNotMatch(app, /admin@ncc\.test|NCCDemo400|localStorage|sessionStorage/i);
  assert.match(app, /Admin login is not enabled/i);
});

test("payment page does not display a UPI QR or collect payment references", () => {
  assert.match(payment, /Payment is not enabled/i);
  assert.match(payment, /Do not pay/i);
  assert.doesNotMatch(payment, /upi:\\/\\/pay|ncc-demo@upi|<img[^>]*qr|<input/i);
  assert.doesNotMatch(payment, /upi:\\/\\/pay|ncc-demo@upi|<img[^>]*qr|<input/i);
});

test("preview JavaScript blocks any legacy form submission without persisting personal data", () => {
  assert.match(app, /event\.preventDefault\(\)/);
  assert.match(app, /secure participant storage/i);
  assert.match(app, /server-side authentication/i);
  assert.doesNotMatch(app, /localStorage|sessionStorage|password\s*:/i);
});

test("stylesheet includes responsive and reduced-motion support", () => {
  assert.match(css, /@media/i);
  assert.match(css, /prefers-reduced-motion/i);
});
