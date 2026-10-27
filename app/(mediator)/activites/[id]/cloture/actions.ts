"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TEXT_FIELD_LIMITS: Record<string, number> = {
  worked_well: 500,
  journal_surprise: 500,
  journal_quote: 300,
  journal_learning: 500,
};

const CHIP_FIELDS = new Set(["period", "audience", "event_context"]);

/**
 * Sauvegarde automatique, champ par champ — jamais de bouton "Enregistrer"
 * sur cet écran (PRD V2 §3). `field` est vérifié contre une liste fermée :
 * jamais une colonne arbitraire fournie par le client. mediator_id n'est
 * jamais touché ; RLS (activities_update_self, participant-aware depuis
 * l'Étape 10) fait le reste de la vérification d'accès.
 */
export async function updateActivityField(
  activityId: string,
  field: string,
  value: string | string[] | boolean | null,
) {
  if (field in TEXT_FIELD_LIMITS) {
    const limit = TEXT_FIELD_LIMITS[field];
    if (typeof value === "string" && value.length > limit) {
      throw new Error(`Ce champ est limité à ${limit} caractères.`);
    }
  } else if (CHIP_FIELDS.has(field)) {
    // valeur unique ou null, pas de limite de longueur à vérifier ici.
  } else if (field !== "supports_used" && field !== "media_captured" && field !== "started_at" && field !== "ended_at") {
    throw new Error("Champ inconnu.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .update({ [field]: value })
    .eq("id", activityId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function addMisconception(activityId: string, content: string, barrierId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Session expirée.");
  }

  const trimmed = content.trim().slice(0, 200);
  if (!trimmed) {
    throw new Error("Merci de décrire l'idée reçue.");
  }

  const { data, error } = await supabase
    .from("activity_misconceptions")
    .insert({
      activity_id: activityId,
      mediator_id: user.id,
      content: trimmed,
      barrier_id: barrierId,
    })
    .select("id, content, barrier_id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Enregistrement impossible.");
  }

  return data;
}

/**
 * Retrait par archivage (jamais de suppression réelle côté médiateur,
 * cohérent avec le reste du schéma) — autorisé pour le créateur ou un
 * participant de l'action, pas seulement l'auteur de l'entrée (0009_
 * misconceptions_participant_rls.sql).
 */
export async function removeMisconception(misconceptionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("activity_misconceptions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", misconceptionId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * close_activity ne bloque jamais sur un champ facultatif vide (PRD V2,
 * Étape 12) : aucune validation de complétude ici, juste l'appel RPC.
 */
export async function closeActivityAction(activityId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_activity", { p_activity_id: activityId });

  if (error) {
    redirect(`/activites/${activityId}/cloture?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/activites/${activityId}?saved=1`);
}
