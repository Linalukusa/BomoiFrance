"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Un médiateur ne supprime jamais réellement une entrée : archivage
 * (soft delete) uniquement. PRD §4.6. Aucune policy RLS DELETE n'existe
 * pour ce rôle — seule cette voie (UPDATE archived_at) est possible.
 * Réservé au créateur (guard_activity_update, 0007_v2_activity_flow.sql) :
 * un participant ne peut pas archiver l'action d'un autre.
 */
export async function archiveActivity(activityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("activities")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", activityId)
    .eq("mediator_id", user.id);

  redirect("/activites");
}
