/** True when Supabase env vars are present and non-placeholder */
export const isSupabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  !!(import.meta.env.VITE_SUPABASE_URL as string).includes("supabase.co") &&
  (import.meta.env.VITE_SUPABASE_URL as string) !== "https://your-project-ref.supabase.co";
