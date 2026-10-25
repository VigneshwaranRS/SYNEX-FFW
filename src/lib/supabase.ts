import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[SYNEX] Supabase is not configured. " +
      "Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. " +
      "The site will render with default content until Supabase is connected."
  );
}

/**
 * Public Supabase client — uses the anon key only.
 * The service_role key MUST NOT be placed here or in any VITE_ variable.
 * Privileged operations are handled via Supabase Edge Functions.
 *
 * When env vars are missing (local dev before setup), the client is created
 * with placeholder values. API calls will fail gracefully — contexts fall back
 * to defaults and do not crash the app.
 */
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
