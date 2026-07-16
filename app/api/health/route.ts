import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vérification de connectivité Supabase — critère de fin de l'Étape 1
 * (DEVELOPMENT_PLAN.md). Ne renvoie aucune donnée métier, uniquement un
 * indicateur de bon fonctionnement (le nombre de freins pré-remplis par la
 * migration confirme que le schéma est bien appliqué).
 */
export async function GET() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { ok: false, error: "Variables d'environnement Supabase manquantes." },
      { status: 503 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("barriers")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({ ok: true, barriersSeeded: count });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erreur inconnue.",
      },
      { status: 503 },
    );
  }
}
