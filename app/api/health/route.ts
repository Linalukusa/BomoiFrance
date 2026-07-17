import { NextResponse } from "next/server";

/**
 * Vérification de connectivité Supabase — critère de fin de l'Étape 1
 * (DEVELOPMENT_PLAN.md).
 *
 * Interroge directement les endpoints HTTP de Supabase plutôt que de passer
 * par supabase-js : les erreurs de la librairie se sont révélées peu fiables
 * pour le diagnostic (objets d'erreur vides selon le mode d'échec). Un appel
 * fetch brut donne le vrai code HTTP et le vrai corps de réponse renvoyés
 * par Supabase, sans transformation intermédiaire.
 *
 * Trois vérifications indépendantes :
 * - authService : le service GoTrue (auth) répond-il ? (endpoint public,
 *   sans clé — si ça échoue, le projet Supabase est probablement en pause
 *   ou l'URL est fausse, indépendamment de toute clé API)
 * - restViaAnonKey : la clé publique (celle du navigateur) est-elle valide ?
 * - restViaServiceRole : la clé privée (utilisée côté serveur) est-elle valide ?
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missingEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (key) => !process.env[key],
  );
  if (missingEnv.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Variables d'environnement manquantes : ${missingEnv.join(", ")}` },
      { status: 503 },
    );
  }

  const [authService, restViaAnonKey, restViaServiceRole] = await Promise.all([
    rawCheck(`${url}/auth/v1/health`),
    rawCheck(`${url}/rest/v1/barriers?select=id&limit=1`, {
      apikey: anonKey!,
      Authorization: `Bearer ${anonKey}`,
    }),
    rawCheck(`${url}/rest/v1/barriers?select=id&limit=1`, {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
    }),
  ]);

  const ok = [authService, restViaAnonKey, restViaServiceRole].every((check) => check.status === 200);

  return NextResponse.json(
    { ok, authService, restViaAnonKey, restViaServiceRole },
    { status: ok ? 200 : 503 },
  );
}

async function rawCheck(url: string, headers: Record<string, string> = {}) {
  try {
    const response = await fetch(url, { headers, cache: "no-store" });
    const body = await response.text();
    return { status: response.status, body: body.slice(0, 300) };
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}${error.cause ? ` (cause: ${String(error.cause)})` : ""}`
        : String(error);
    return { status: null, error: message };
  }
}
