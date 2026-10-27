"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type CounterName =
  | "people_reached"
  | "meaningful_conversations"
  | "interested_people"
  | "orientations_in_person"
  | "orientations_remote";

export type CounterValues = {
  people_reached: number;
  meaningful_conversations: number;
  interested_people: number;
  orientations_in_person: number;
  orientations_remote: number;
};

/**
 * Appelée directement depuis le client (pas via <form>) à chaque tap sur un
 * compteur — voir TerrainCounters.tsx pour la file de réessai en mémoire en
 * cas d'échec réseau. increment_activity_counter fait tout le bornage
 * (jamais sous 0, clamp descendant) côté base ; cette action ne fait que
 * relayer l'appel et renvoyer les valeurs à jour.
 */
export async function incrementCounterAction(
  activityId: string,
  counter: CounterName,
  delta: number,
): Promise<CounterValues> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("increment_activity_counter", {
    p_activity_id: activityId,
    p_counter: counter,
    p_delta: delta,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row as CounterValues;
}

/**
 * Idem pour les freins : increment_barrier gère l'upsert et la suppression
 * de la ligne à occurrences = 0 (contrainte occurrences >= 1).
 */
export async function incrementBarrierAction(
  activityId: string,
  barrierId: string,
  delta: number,
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("increment_barrier", {
    p_activity_id: activityId,
    p_barrier_id: barrierId,
    p_delta: delta,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as number;
}

/**
 * Écran de clôture pas encore construit (Étape 12) : en attendant, retour
 * au détail de l'action, qui affiche l'état "à compléter".
 */
export async function endActivityAction(activityId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_activity", { p_activity_id: activityId });

  if (error) {
    redirect(`/activites/${activityId}/terrain?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/activites/${activityId}`);
}
