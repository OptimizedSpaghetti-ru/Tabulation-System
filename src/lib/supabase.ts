import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

// Local development uses .env.local. Figma Make supplies these public values
// through its managed integration; neither path contains a service-role key.
const url = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey;

export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured ? createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
}) : null;

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.");
  return supabase;
}

export function usernameToAuthEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@tabulation.local`;
}

export function authEmailToUsername(email?: string | null): string {
  if (!email) return "";
  if (email.endsWith("@tabulation.local")) {
    return email.replace("@tabulation.local", "");
  }
  return email;
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim());
}
