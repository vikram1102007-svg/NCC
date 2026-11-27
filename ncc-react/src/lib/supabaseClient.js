import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CONFIG, isSupabaseConfigured } from "./supabaseConfig.js";

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
