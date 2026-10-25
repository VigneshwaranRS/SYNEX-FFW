/**
 * Untyped Supabase client for admin page use.
 * 
 * The typed client (supabase.ts) uses our manually-written Database types.
 * These types occasionally cause false-positive TS errors on insert/update
 * chains with Partial<> types. Admin pages that do complex upsert operations
 * use this untyped client.
 * 
 * Security note: This client still uses the anon key only. All writes are
 * protected by RLS policies. The service_role key lives in Edge Functions only.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = createClient<any>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
