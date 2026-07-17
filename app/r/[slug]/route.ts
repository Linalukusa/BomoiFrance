import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Route publique, non authentifiée : ce sont les personnes sensibilisées qui
 * cliquent, pas les médiateurs. RÈGLE ABSOLUE (SECURITY.md) : aucune IP, user
 * agent ou autre identifiant de la requête n'est jamais lu ni stocké ici —
 * seul le compteur agrégé click_count est incrémenté, de façon atomique, via
 * la fonction SECURITY DEFINER increment_link_click.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const targetUrl = process.env.EFS_TARGET_URL || "https://dondesang.efs.sante.fr";

  const supabase = createAdminClient();
  await supabase.rpc("increment_link_click", { p_slug: slug });

  return NextResponse.redirect(targetUrl, { status: 302 });
}
