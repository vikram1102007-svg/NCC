// Public browser configuration helper only.
// Never store a Supabase service_role key or server secret in client-side env variables.
const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

export const SUPABASE_CONFIG = Object.freeze({
  url: String(env.VITE_SUPABASE_URL || "").trim(),
  anonKey: String(env.VITE_SUPABASE_ANON_KEY || "").trim(),
  eventSlug: String(env.VITE_EVENT_SLUG || "").trim(),
  registrationEnabled: String(env.VITE_REGISTRATION_ENABLED || "false") === "true"
});

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.registrationEnabled
  );
}
