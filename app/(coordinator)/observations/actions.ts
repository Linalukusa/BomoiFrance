"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireCoordinatorOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "coordinator" && profile?.role !== "admin") {
    redirect("/dashboard?error=non_autorise");
  }

  return { supabase, userId: user.id };
}

export async function addFieldObservation(formData: FormData) {
  const { supabase, userId } = await requireCoordinatorOrAdmin();

  const observationDate = formData.get("observation_date") as string;
  const campus = ((formData.get("campus") as string) || "").trim() || null;
  const mediatorId = (formData.get("mediator_id") as string) || null;
  const activityId = (formData.get("activity_id") as string) || null;
  const content = ((formData.get("content") as string) || "").trim().slice(0, 1000);

  if (!observationDate || !content) {
    redirect(`/observations?error=${encodeURIComponent("Merci de renseigner la date et le contenu.")}`);
  }

  const { error } = await supabase.from("field_observations").insert({
    observation_date: observationDate,
    campus,
    mediator_id: mediatorId,
    activity_id: activityId,
    content,
    created_by: userId,
  });

  if (error) {
    redirect(`/observations?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/observations?saved=1");
}

export async function archiveFieldObservation(observationId: string) {
  const { supabase } = await requireCoordinatorOrAdmin();

  const { error } = await supabase
    .from("field_observations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", observationId);

  if (error) {
    redirect(`/observations?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/observations?saved=1");
}
