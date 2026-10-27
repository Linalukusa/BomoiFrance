"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Coordinateur/admin uniquement — jamais le médiateur lui-même (route sous
 * app/(coordinator)/, déjà protégée par page.tsx). Le trigger
 * guard_mediator_journey_fields (0010) revérifie côté base que seul un
 * coordinateur/admin peut toucher ces deux colonnes, même en cas d'appel
 * direct à l'API hors de cette Server Action.
 */
export async function issueCertificate(mediatorId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("mediators")
    .update({ certificate_status: "genere", certificate_issued_at: new Date().toISOString() })
    .eq("id", mediatorId);

  if (error) {
    redirect(`/mediateurs/${mediatorId}/attestation?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/mediateurs/${mediatorId}/attestation?saved=1`);
}
