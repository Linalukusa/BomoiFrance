import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase pour Server Components / Server Actions / Route Handlers,
 * lié à la session de l'utilisateur connecté. RLS s'applique normalement —
 * ce n'est pas un client privilégié (voir admin.ts pour les opérations serveur
 * qui doivent contourner RLS de façon contrôlée).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : les Server Actions/middleware
            // rafraîchissent la session, cet appel peut être ignoré sans risque.
          }
        },
      },
    },
  );
}
