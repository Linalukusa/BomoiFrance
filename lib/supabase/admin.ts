import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase privilégié (clé service_role) : contourne RLS.
 *
 * Réservé aux quelques opérations documentées dans SECURITY.md §3 (invitation
 * d'un médiateur, incrément du compteur de clics EFS). Ne jamais importer ce
 * fichier depuis un composant client ni renvoyer son résultat brut au client
 * sans revue — `server-only` fait échouer le build si c'est le cas.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
