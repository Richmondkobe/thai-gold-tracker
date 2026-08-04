import { createClient } from "@supabase/supabase-js";

/**
 * Anon-key Supabase client for read-only queries from Server Components.
 * Safe to use server-side or client-side — access is bounded by RLS
 * (public SELECT only, see supabase/migrations/0001_gold_prices.sql).
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
