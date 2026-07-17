"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orientationSchema } from "@/lib/validation/orientation";

function backToForm(activityId: string | null, message: string): never {
  const params = new URLSearchParams({ error: message });
  if (activityId) {
    params.set("activity_id", activityId);
  }
  redirect(`/orientations/nouveau?${params.toString()}`);
}

export async function createOrientation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activityId = (formData.get("activity_id") as string) || null;

  const parsed = orientationSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    backToForm(activityId, parsed.error.issues[0]?.message ?? "Formulaire invalide.");
  }

  const { collection_id, orientation_date, channel, status } = parsed.data;

  const { error } = await supabase.from("orientations").insert({
    mediator_id: user.id,
    activity_id: activityId,
    collection_id: collection_id || null,
    orientation_date,
    channel,
    status,
  });

  if (error) {
    backToForm(activityId, error.message || "Enregistrement impossible.");
  }

  redirect(activityId ? `/activites/${activityId}` : "/orientations");
}
