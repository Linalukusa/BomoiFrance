"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";

const ACTIVITY_TYPE_VALUES: readonly string[] = ACTIVITY_TYPE_OPTIONS.map((option) => option.value);

/**
 * Démarre une action partagée via la RPC start_activity (voir
 * supabase/migrations/0007_v2_activity_flow.sql) : crée l'activité
 * (status = en_cours) et insère le créateur + les participants choisis en
 * une seule transaction. Les chiffres se saisissent ensuite sur l'écran
 * terrain, pas ici.
 */
export async function startActivity(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const campus = (formData.get("campus") as string) || "";
  const activityType = (formData.get("activity_type") as string) || "";
  const collectionId = (formData.get("collection_id") as string) || null;
  const participantIds = formData.getAll("participant_ids") as string[];

  if (!campus || !ACTIVITY_TYPE_VALUES.includes(activityType)) {
    redirect(
      `/activites/nouveau?error=${encodeURIComponent("Merci de choisir un lieu et un type d'action.")}`,
    );
  }

  const { data: activityId, error } = await supabase.rpc("start_activity", {
    p_campus: campus,
    p_activity_type: activityType,
    p_collection_id: collectionId,
    p_participant_ids: participantIds,
  });

  if (error || !activityId) {
    redirect(
      `/activites/nouveau?error=${encodeURIComponent(error?.message ?? "Impossible de démarrer l'action.")}`,
    );
  }

  redirect(`/activites/${activityId}/terrain`);
}
