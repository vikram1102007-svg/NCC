import { withSupabase } from "npm:@supabase/server";
import {
  normalizeRegistrationPayload,
  validateRegistrationPayload
} from "../_shared/registration-validation.mjs";

const DEFAULT_ORIGINS = [
  "https://ncc-event-management.embarko.app",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
];

function allowedOrigins() {
  const configured = (Deno.env.get("NCC_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ORIGINS);
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request) {
  const direct = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
  if (direct?.trim()) return direct.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded?.trim()) return forwarded.split(",")[0].trim();
  return "";
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const origin = req.headers.get("origin") ?? "";
    const origins = allowedOrigins();

    if (!origin || !origins.has(origin)) {
      return jsonResponse({ error: "origin_not_allowed" }, 403);
    }

    const headers = corsHeaders(origin);
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 204, headers });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405, headers);
    }

    if (Deno.env.get("NCC_REGISTRATION_ENABLED") !== "true") {
      return jsonResponse({ error: "registration_not_enabled" }, 403, headers);
    }

    const rateLimitSecret = Deno.env.get("NCC_RATE_LIMIT_SECRET") ?? "";
    if (rateLimitSecret.length < 32) {
      return jsonResponse({ error: "registration_service_not_configured" }, 503, headers);
    }

    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > 16_384) {
      return jsonResponse({ error: "request_too_large" }, 413, headers);
    }

    let rawBody = "";
    try {
      rawBody = await req.text();
      if (new TextEncoder().encode(rawBody).length > 16_384) {
        return jsonResponse({ error: "request_too_large" }, 413, headers);
      }
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400, headers);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400, headers);
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "invalid_request" }, 400, headers);
    }
    const payload = body as Record<string, unknown>;

    // Honeypot field: bots should not receive a useful error detail.
    if (String(payload.website ?? "").trim() !== "") {
      return jsonResponse({ error: "request_rejected" }, 400, headers);
    }

    const validation = validateRegistrationPayload(payload);
    if (!validation.ok) {
      return jsonResponse({ error: "validation_failed", fields: validation.errors }, 422, headers);
    }

    const value = normalizeRegistrationPayload(payload);
    const clientIp = getClientIp(req);
    if (!clientIp) {
      return jsonResponse({ error: "rate_limit_context_unavailable" }, 503, headers);
    }

    try {
      const ipHash = await hmacHex(rateLimitSecret, `ip:${clientIp}`);
      const emailHash = await hmacHex(rateLimitSecret, `email:${value.contactEmail}`);
      const admin = ctx.supabaseAdmin;

      const ipLimit = await admin.rpc("consume_registration_rate_limit", {
        p_subject_hash: ipHash,
        p_max_requests: 10,
        p_window_seconds: 600
      });
      if (ipLimit.error) throw ipLimit.error;
      if (ipLimit.data !== true) {
        return jsonResponse({ error: "rate_limit_exceeded" }, 429, headers);
      }

      const emailLimit = await admin.rpc("consume_registration_rate_limit", {
        p_subject_hash: emailHash,
        p_max_requests: 3,
        p_window_seconds: 3600
      });
      if (emailLimit.error) throw emailLimit.error;
      if (emailLimit.data !== true) {
        return jsonResponse({ error: "rate_limit_exceeded" }, 429, headers);
      }

      const requestHash = await sha256Hex(JSON.stringify({
        eventSlug: value.eventSlug,
        categoryCode: value.categoryCode,
        contactName: value.contactName,
        contactEmail: value.contactEmail,
        contactPhone: value.contactPhone,
        institutionName: value.institutionName,
        teamName: value.teamName,
        memberNames: value.memberNames
      }));

      const result = await admin.rpc("create_public_registration", {
        p_event_slug: value.eventSlug,
        p_category_code: value.categoryCode,
        p_idempotency_key: value.idempotencyKey,
        p_request_hash: requestHash,
        p_contact_name: value.contactName,
        p_contact_email: value.contactEmail,
        p_contact_phone: value.contactPhone,
        p_institution_name: value.institutionName,
        p_team_name: value.teamName || null,
        p_member_names: value.memberNames
      });

      if (result.error) {
        const code = (result.error as { code?: string }).code;
        if (code === "23505") {
          return jsonResponse({ error: "duplicate_registration" }, 409, headers);
        }
        if (code === "22023") {
          return jsonResponse({ error: "registration_details_rejected" }, 422, headers);
        }
        if (code === "P0001") {
          return jsonResponse({ error: "registration_closed_or_full" }, 409, headers);
        }
        throw result.error;
      }

      const registration = Array.isArray(result.data) ? result.data[0] : null;
      if (!registration?.registration_ref) {
        throw new Error("Registration RPC returned no registration reference");
      }

      return jsonResponse({
        ok: true,
        registrationRef: registration.registration_ref,
        status: registration.registration_status,
        created: registration.created
      }, registration.created ? 201 : 200, headers);
    } catch (error) {
      console.error("NCC registration request failed; internal details suppressed");
      return jsonResponse({ error: "registration_temporarily_unavailable" }, 503, headers);
    }
  })
};
