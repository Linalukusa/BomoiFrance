"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activitySchema } from "@/lib/validation/activity";

/**
 * L'UI (steppers bornés, campus par défaut, bouton désactivé sans type)
 * empêche déjà la quasi-totalité des états invalides — cette validation
 * est un rempart, pas le chemin normal.
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

  const { support_used, duration, note, ...rest } = parsed.data;

  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      mediator_id: user.id,
      ...rest,
      support_used: support_used || null,
      duration: duration || null,
      note: note || null,
    })
    .select("id")
    .single();

  if (error || !activity) {
    redirect(
      `/activites/nouveau?error=${encodeURIComponent(error?.message ?? "Enregistrement impossible.")}`,
    );
  }

  redirect(`/activites/${activity.id}`);
}
