const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("registration validator normalises a valid individual submission", async () => {
  const { validateRegistrationPayload } = await import("../supabase/functions/_shared/registration-validation.mjs");
  const result = validateRegistrationPayload({
    eventSlug: "NCC-2026",
    categoryCode: "DRILL-INDIVIDUAL",
    idempotencyKey: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    contactName: "  Cadet Example ",
    contactEmail: "CADET@example.org ",
    contactPhone: "+91 98765 43210",
    institutionName: " Example College ",
    teamName: "",
    memberNames: []
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.eventSlug, "ncc-2026");
  assert.equal(result.value.contactEmail, "cadet@example.org");
  assert.equal(result.value.contactName, "Cadet Example");
});

test("registration validator rejects malformed identifiers and contact fields", async () => {
  const { validateRegistrationPayload } = await import("../supabase/functions/_shared/registration-validation.mjs");
  const result = validateRegistrationPayload({
    eventSlug: "not a slug",
    categoryCode: "bad category",
    idempotencyKey: "not-a-uuid",
    contactName: "A",
    contactEmail: "not-an-email",
    contactPhone: "abc",
    institutionName: "",
    memberNames: []
  });
  assert.equal(result.ok, false);
  for (const field of ["eventSlug", "categoryCode", "idempotencyKey", "contactName", "contactEmail", "contactPhone", "institutionName"]) {
    assert.ok(result.errors[field], "expected validation error for " + field);
  }
});

test("registration validator bounds team member input", async () => {
  const { validateRegistrationPayload } = await import("../supabase/functions/_shared/registration-validation.mjs");
  const base = {
    eventSlug: "ncc-event",
    categoryCode: "team-drill",
    idempotencyKey: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    contactName: "Team Lead",
    contactEmail: "lead@example.org",
    contactPhone: "+91 98765 43210",
    institutionName: "Example College",
    teamName: "Bravo",
    memberNames: Array.from({ length: 26 }, (_, index) => "Cadet " + (index + 1))
  };
  const result = validateRegistrationPayload(base);
  assert.equal(result.ok, false);
  assert.ok(result.errors.memberNames);
});

test("registration migration enables RLS and limits privileged RPC execution", () => {
  const sql = readFileSync(path.join(root, "supabase/migrations/20261124210000_ncc_registration_foundation.sql"), "utf8");
  assert.match(sql, /alter table public\.registrations enable row level security/i);
  assert.match(sql, /create policy "published events are public"/i);
  assert.match(sql, /revoke all on function public\.create_public_registration[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_public_registration[\s\S]*to service_role/i);
  assert.match(sql, /set search_path = pg_catalog, public, pg_temp/i);
  assert.match(sql, /for update;/i);
  assert.match(sql, /unique index if not exists registrations_event_category_email_key/i);
});

test("registration migration has complete guards and no duplicated SQL fragments", () => {
  const sql = readFileSync(path.join(root, "supabase/migrations/20261124210000_ncc_registration_foundation.sql"), "utf8");
  assert.ok(sql.includes("or p_event_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'"));
  assert.ok(sql.includes("or p_category_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$'"));
  assert.ok(sql.includes("or p_request_hash !~ '^[a-f0-9]{64}$'"));
  assert.equal(sql.split("create or replace function public.create_public_registration").length - 1, 1);
  assert.equal(sql.split("grant execute on function public.create_public_registration").length - 1, 1);
  assert.ok(sql.trimEnd().endsWith("grant execute on function public.create_public_registration(text, text, uuid, text, text, text, text, text, text, text[]) to service_role;"));
});


test("registration validator safely rejects non-object JSON bodies", async () => {
  const { validateRegistrationPayload, normalizeRegistrationPayload } = await import("../supabase/functions/_shared/registration-validation.mjs");
  for (const input of [null, [], "not-an-object", 42]) {
    const result = validateRegistrationPayload(input);
    assert.equal(result.ok, false);
    assert.ok(result.errors.payload);
    assert.equal(result.value.contactName, "");
  }
  assert.equal(normalizeRegistrationPayload(null).eventSlug, "");
});

test("registration endpoint rejects non-object JSON before reading honeypot fields", () => {
  const source = readFileSync(path.join(root, "supabase/functions/register/index.ts"), "utf8");
  const shapeGuard = source.indexOf('body === null || typeof body !== "object" || Array.isArray(body)');
  const honeypotRead = source.indexOf('payload.website');
  assert.ok(shapeGuard >= 0);
  assert.ok(honeypotRead > shapeGuard);
  assert.match(source, /return jsonResponse\(\{ error: "invalid_request" \}, 400, headers\)/);
});

test("registration RPC explicitly validates the contact name before insert", () => {
  const sql = readFileSync(path.join(root, "supabase/migrations/20261124210000_ncc_registration_foundation.sql"), "utf8");
  assert.ok(sql.includes("or char_length(trim(coalesce(p_contact_name, ''))) not between 2 and 100"));
});

test("registration validator rejects object and numeric values instead of coercing them to strings", async () => {
  const { validateRegistrationPayload } = await import("../supabase/functions/_shared/registration-validation.mjs");
  const valid = {
    eventSlug: "ncc-event",
    categoryCode: "individual",
    idempotencyKey: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    contactName: { toString: () => "Cadet Example" },
    contactEmail: "cadet@example.org",
    contactPhone: "+91 98765 43210",
    institutionName: "Example College",
    teamName: "",
    memberNames: []
  };
  const nonStringName = validateRegistrationPayload(valid);
  assert.equal(nonStringName.ok, false);
  assert.ok(nonStringName.errors.contactName);
  assert.equal(nonStringName.value.contactName, "");

  valid.contactName = "Cadet Example";
  valid.memberNames = ["Cadet One", 2, { name: "Cadet Three" }];
  const nonStringMembers = validateRegistrationPayload(valid);
  assert.equal(nonStringMembers.ok, false);
  assert.ok(nonStringMembers.errors.memberNames);
  assert.deepEqual(nonStringMembers.value.memberNames, ["Cadet One", "", ""]);
});

test("registration endpoint enforces origin allowlist and bounded request size", () => {
  const source = readFileSync(path.join(root, "supabase/functions/register/index.ts"), "utf8");
  assert.match(source, /const DEFAULT_ORIGINS = \[/);
  assert.match(source, /if \(!origin \|\| !origins\.has\(origin\)\)/);
  assert.match(source, /contentLength > 16_384/);
  assert.match(source, /new TextEncoder\(\)\.encode\(rawBody\)\.length > 16_384/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/);
});

test("registration endpoint requires server-only rate-limit secret and applies IP/email quotas", () => {
  const source = readFileSync(path.join(root, "supabase/functions/register/index.ts"), "utf8");
  assert.match(source, /Deno\.env\.get\("NCC_RATE_LIMIT_SECRET"\)/);
  assert.match(source, /rateLimitSecret\.length < 32/);
  assert.match(source, /p_max_requests: 10,[\s\S]*p_window_seconds: 600/);
  assert.match(source, /p_max_requests: 3,[\s\S]*p_window_seconds: 3600/);
  assert.match(source, /hmacHex\(rateLimitSecret, `ip:/);
  assert.match(source, /hmacHex\(rateLimitSecret, `email:/);
  assert.doesNotMatch(source, /console\.log\([^\n]*(?:contactEmail|contactPhone|contactName|memberNames)/);
});

test("public browser config contains no server-side credential names", () => {
  const config = readFileSync(path.join(root, "scripts/config.js"), "utf8");
  assert.doesNotMatch(config, /service_role|secret[_-]?key|NCC_RATE_LIMIT_SECRET|NCC_REGISTRATION_ENABLED/i);
});
