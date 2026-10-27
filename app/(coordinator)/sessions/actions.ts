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

  return { supabase };
}

export async function addSession(formData: FormData) {
  const { supabase } = await requireCoordinatorOrAdmin();

  const sessionDate = formData.get("session_date") as string;
  const label = ((formData.get("label") as string) || "").trim().slice(0, 200);
  const durationMinutes = Number(formData.get("duration_minutes"));

  if (!sessionDate || !label || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    redirect(`/sessions?error=${encodeURIComponent("Merci de renseigner une date, un intitulé et une durée valide.")}`);
  }

  const { error } = await supabase
    .from("sessions")
    .insert({ session_date: sessionDate, label, duration_minutes: Math.round(durationMinutes) });

  if (error) {
    redirect(`/sessions?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/sessions?saved=1");
}

/**
 * Remplace entièrement la liste des présents : plus simple et tout aussi
 * sûr qu'un diff incrémental pour une action à faible fréquence (gérée une
 * poignée de fois par formation, pas en temps réel comme les compteurs
 * terrain) — chaque sauvegarde part de la liste cochée dans le formulaire.
 */
export async function setSessionAttendance(sessionId: string, formData: FormData) {
  const { supabase } = await requireCoordinatorOrAdmin();

  const mediatorIds = formData.getAll("mediator_ids") as string[];

  const { error: deleteError } = await supabase
    .from("session_attendance")
    .delete()
    .eq("session_id", sessionId);

  if (deleteError) {
    redirect(`/sessions/${sessionId}?error=${encodeURIComponent(deleteError.message)}`);
  }

  if (mediatorIds.length > 0) {
    const { error: insertError } = await supabase
      .from("session_attendance")
      .insert(mediatorIds.map((mediatorId) => ({ session_id: sessionId, mediator_id: mediatorId })));

    if (insertError) {
      redirect(`/sessions/${sessionId}?error=${encodeURIComponent(insertError.message)}`);
    }
  }

  redirect(`/sessions/${sessionId}?saved=1`);
}
