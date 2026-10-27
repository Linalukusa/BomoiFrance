"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Le consentement recherche ne peut être donné ou retiré que par le
 * médiateur lui-même — revérifié côté base par le trigger
 * guard_mediator_journey_fields (0010), pas seulement ici. Redonner son
 * consentement après un retrait efface la date de retrait (nouvel épisode
 * de consentement) ; la retirer laisse research_consent_at intact,
 * research_withdrawn_at suffit à marquer l'état actuel comme non actif.
 */
export async function giveResearchConsent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("mediators")
    .update({ research_consent_at: new Date().toISOString(), research_withdrawn_at: null })
    .eq("id", user.id);

  if (error) {
    redirect(`/parcours?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/parcours?saved=1");
}

export async function withdrawResearchConsent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("mediators")
    .update({ research_withdrawn_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    redirect(`/parcours?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/parcours?saved=1");
}
