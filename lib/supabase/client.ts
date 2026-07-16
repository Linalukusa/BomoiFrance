import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase pour les composants navigateur ("use client").
 * Utilise la clé publique (anon) — toute la protection vient de RLS, jamais de ce client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
