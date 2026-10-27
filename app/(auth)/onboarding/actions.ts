"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Valide les deux engagements côté serveur — jamais uniquement côté client.
 * L'accès au reste de l'application reste bloqué (middleware) tant que les
 * deux horodatages ne sont pas renseignés.
 */
export async function acceptOnboarding(formData: FormData) {
  const charterAccepted = formData.get("charter_accepted") === "on";
  const privacyAccepted = formData.get("privacy_accepted") === "on";
  const researchConsent = formData.get("research_consent") === "on";

  if (!charterAccepted || !privacyAccepted) {
    redirect("/onboarding?error=engagements_incomplets");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("mediators")
    .update({
      charter_accepted_at: now,
      privacy_accepted_at: now,
      // Troisième case, facultative et sans effet bloquant (PRD V2, Étape
      // 13) : ne renseigner research_consent_at que si elle est cochée,
      // jamais l'écraser à null sinon (un médiateur pourrait revenir sur
      // cet écran après avoir déjà consenti ailleurs — improbable mais pas
      // à casser pour autant).
      ...(researchConsent ? { research_consent_at: now } : {}),
    })
    .eq("id", user.id);

  if (error) {
    redirect("/onboarding?error=enregistrement_impossible");
  }

  redirect("/accueil");
}
