"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { barrierEntrySchema } from "@/lib/validation/barrier";

function backToForm(activityId: string | null, message: string): never {
  const params = new URLSearchParams({ error: message });
  if (activityId) {
    params.set("activity_id", activityId);
  }
  redirect(`/freins/nouveau?${params.toString()}`);
}

export async function createBarrierEntry(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activityId = (formData.get("activity_id") as string) || null;
  const barrierIds = formData.getAll("barrier_ids") as string[];
  const note = formData.get("note") as string | null;

  const parsed = barrierEntrySchema.safeParse({
    activity_id: activityId,
    barrier_ids: barrierIds,
    note: note ?? undefined,
  });

  if (!parsed.success) {
    backToForm(activityId, parsed.error.issues[0]?.message ?? "Formulaire invalide.");
  }

  const rows = parsed.data.barrier_ids.map((barrierId) => ({
    activity_id: parsed.data.activity_id,
    barrier_id: barrierId,
    mediator_id: user.id,
    note: parsed.data.note || null,
  }));

  // upsert + ignoreDuplicates plutôt qu'un simple insert : (activity_id,
  // barrier_id) est unique, et un médiateur qui revient ajouter des freins
  // sur une activité déjà partiellement renseignée ne doit pas voir toute
  // sa saisie rejetée à cause des freins déjà enregistrés.
  const { error } = await supabase
    .from("activity_barriers")
    .upsert(rows, { onConflict: "activity_id,barrier_id", ignoreDuplicates: true });

  if (error) {
    backToForm(parsed.data.activity_id, error.message || "Enregistrement impossible.");
  }

  redirect(`/activites/${parsed.data.activity_id}`);
}
