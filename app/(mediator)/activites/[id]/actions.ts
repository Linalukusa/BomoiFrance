"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activitySchema } from "@/lib/validation/activity";

export async function updateActivity(activityId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = activitySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(
      `/activites/${activityId}?edit=1&error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Formulaire invalide.",
      )}`,
    );
  }

  const { support_used, duration, note, ...rest } = parsed.data;

  const { error } = await supabase
    .from("activities")
    .update({
      ...rest,
      support_used: support_used || null,
      duration: duration || null,
      note: note || null,
    })
    .eq("id", activityId)
    .eq("mediator_id", user.id);

  if (error) {
    redirect(
      `/activites/${activityId}?edit=1&error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(`/activites/${activityId}`);
}

/**
 * Un médiateur ne supprime jamais réellement une entrée : archivage
 * (soft delete) uniquement. PRD §4.6. Aucune policy RLS DELETE n'existe
 * pour ce rôle — seule cette voie (UPDATE archived_at) est possible.
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
