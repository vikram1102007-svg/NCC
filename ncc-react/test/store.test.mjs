import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCsv, computeStats, sanitizeCsvCell } from "../src/lib/store.js";
import { SUPABASE_CONFIG, isSupabaseConfigured } from "../src/lib/supabaseConfig.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const reactRoot = path.resolve(dir, "..");

test("sanitizeCsvCell neutralises formula injection prefixes", () => {
  assert.equal(sanitizeCsvCell("=CMD()"), "\"'=CMD()\"");
  assert.equal(sanitizeCsvCell("+123"), "\"'+123\"");
  assert.equal(sanitizeCsvCell("-123"), "\"'-123\"");
  assert.equal(sanitizeCsvCell("@SUM(A1)"), "\"'@SUM(A1)\"");
  assert.equal(sanitizeCsvCell("  =1+1"), "\"'  =1+1\"");
  assert.equal(sanitizeCsvCell('Cadet "A"'), '"Cadet ""A"""');
});

test("buildCsv formats headers and sanitizes rows", () => {
  const csv = buildCsv(
    [
      {
        id: "NCC-1",
        qrToken: "TKN-ABC",
        name: "=Evil",
        email: "cadet@example.test",
        regimentalNo: "TN/01",
        eventId: "drill",
        teamName: "Alpha",
        fee: 400,
        status: "Registered",
        payment: "Demo pending",
        attended: true
      }
    ],
    { drill: { title: "Drill" } }
  );
  assert.match(csv, /^"Reference","Token","Name","Email"/);
  assert.match(csv, /"'=Evil"/);
  assert.match(csv, /"Present"/);
});

test("computeStats excludes cancelled registrations from active counts and totals", () => {
  const stats = computeStats([
    { status: "Registered", payment: "Demo pending", attended: false, fee: 400 },
    { status: "Confirmed", payment: "Demo paid", attended: true, fee: 400 },
    { status: "Cancelled", payment: "Demo paid", attended: true, fee: 400 }
  ]);
  assert.deepEqual(stats, {
    total: 2,
    paid: 1,
    pending: 1,
    attended: 1,
    cancelled: 1,
    feeTotal: 800
  });
});

test("supabaseConfig defaults to Demo Mode and exposes no server-side secret names", () => {
  assert.equal(isSupabaseConfigured(), false);
  assert.equal(SUPABASE_CONFIG.registrationEnabled, false);
  const src = fs.readFileSync(path.join(reactRoot, "src/lib/supabaseConfig.js"), "utf8");
  const envExample = fs.readFileSync(path.join(reactRoot, ".env.example"), "utf8");
  assert.doesNotMatch(src, /VITE_SUPABASE_SERVICE_ROLE|VITE_.*SECRET/i);
  assert.match(envExample, /VITE_SUPABASE_URL=/);
});
