import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Les erreurs PostgREST/Supabase ne sont pas toujours des instances réelles
 * de Error (selon la version, ce sont parfois de simples objets typés
 * {message, code, details, hint}) : `error instanceof Error` peut donc
 * silencieusement masquer le message utile. On tente d'abord message/code,
 * puis on retombe sur un JSON.stringify plutôt qu'un texte générique muet.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const withFields = error as { message?: string; code?: string; details?: string };
    if (withFields.message) {
      return [withFields.message, withFields.code, withFields.details]
        .filter(Boolean)
        .join(" — ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      // ignore, repli ci-dessous
    }
  }
  return String(error);
}

/**
 * Vérification de connectivité Supabase — critère de fin de l'Étape 1
 * (DEVELOPMENT_PLAN.md). Ne renvoie aucune donnée métier, uniquement un
 * indicateur de bon fonctionnement.
 *
 * Teste séparément les deux clés utilisées par l'application : service_role
 * (utilisée uniquement côté serveur) ET anon (celle du navigateur, sur
 * laquelle reposent la connexion et toutes les requêtes RLS). Les vérifier
 * séparément est nécessaire : NEXT_PUBLIC_SUPABASE_ANON_KEY est intégrée au
 * bundle au moment du build Vercel, pas lue à l'exécution — un oubli ou une
 * variable ajoutée après coup ne casse rien côté serveur mais bloque
 * silencieusement toute authentification côté client.
 */
export async function GET() {
  const missingEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Variables d'environnement manquantes : ${missingEnv.join(", ")}` },
      { status: 503 },
    );
  }

  const checks: Record<string, boolean | string> = {};

  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("barriers")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    checks.serviceRole = true;
    checks.barriersSeeded = String(count);
  } catch (error) {
    checks.serviceRole = false;
    checks.serviceRoleError = describeError(error);
  }

  try {
    const anon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    // Requête volontairement anonyme : doit atteindre Supabase (apikey valide)
    // même si RLS ne renvoie aucune ligne sans session. Une erreur ici
    // signifie une clé anon absente/invalide dans le build déployé.
    const { error } = await anon.from("barriers").select("*", { count: "exact", head: true });
    if (error) throw error;
    checks.anonKey = true;
  } catch (error) {
    checks.anonKey = false;
    checks.anonKeyError = describeError(error);
  }

  const ok = checks.serviceRole === true && checks.anonKey === true;

  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 503 });
}
