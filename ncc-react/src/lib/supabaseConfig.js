// Public browser configuration helper.
// Never store a Supabase service_role key in client-side environment variables.
export const SUPABASE_CONFIG = Object.freeze({
  url: (import.meta.env.VITE_SUPABASE_URL || "").trim(),
  anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim()
});

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}
