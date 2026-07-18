"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { activitySchema } from "@/lib/validation/activity";
import { orientationSchema } from "@/lib/validation/orientation";

const pendingOrientationsSchema = z.array(orientationSchema).max(50);

/**
 * L'UI (steppers bornés, campus par défaut, bouton désactivé sans type)
 * empêche déjà la quasi-totalité des états invalides — cette validation
 * est un rempart, pas le chemin normal.
 *
 * Passe par la RPC create_activity_with_orientations (voir
 * supabase/migrations/0003_activity_with_orientations.sql) plutôt qu'un
 * simple insert : les orientations ajoutées dans le même flux doivent être
 * enregistrées avec l'activité en une seule transaction, pour éviter une
 * activité orpheline si l'un des deux échouait séparément.
 */
export async function createActivity(formData: FormData) {
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
      `/activites/nouveau?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Formulaire invalide.")}`,
    );
  }

  const rawOrientations = formData.get("orientations");
  let pendingOrientations: z.infer<typeof pendingOrientationsSchema> = [];

  if (typeof rawOrientations === "string" && rawOrientations.length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawOrientations);
    } catch {
      redirect(`/activites/nouveau?error=${encodeURIComponent("Orientations invalides.")}`);
    }

    const orientationsParsed = pendingOrientationsSchema.safeParse(parsedJson);
    if (!orientationsParsed.success) {
      redirect(
        `/activites/nouveau?error=${encodeURIComponent(
          orientationsParsed.error.issues[0]?.message ?? "Orientation invalide.",
        )}`,
      );
    }
    pendingOrientations = orientationsParsed.data;
  }

  const { support_used, duration, note, ...rest } = parsed.data;

  const { data: activityId, error } = await supabase.rpc("create_activity_with_orientations", {
    p_activity_date: rest.activity_date,
    p_campus: rest.campus,
    p_activity_type: rest.activity_type,
    p_people_reached: rest.people_reached,
    p_meaningful_conversations: rest.meaningful_conversations,
    p_interested_people: rest.interested_people,
    p_support_used: support_used || null,
    p_duration: duration || null,
    p_note: note || null,
    p_orientations: pendingOrientations,
  });

  if (error || !activityId) {
    redirect(
      `/activites/nouveau?error=${encodeURIComponent(error?.message ?? "Enregistrement impossible.")}`,
    );
  }

  redirect(`/activites/${activityId}?saved=1`);
}
