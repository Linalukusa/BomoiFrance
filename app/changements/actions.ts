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
    redirect("/changements?error=non_autorise");
  }

  return { supabase, userId: user.id, role: profile.role };
}

export async function addChangelogEntry(formData: FormData) {
  const { supabase, userId } = await requireCoordinatorOrAdmin();

  const releaseDate = formData.get("release_date") as string;
  const title = ((formData.get("title") as string) || "").trim().slice(0, 200);
  const description = ((formData.get("description") as string) || "").trim().slice(0, 1000) || null;

  if (!releaseDate || !title) {
    redirect(`/changements?error=${encodeURIComponent("Merci de renseigner la date et le titre.")}`);
  }

  const { error } = await supabase
    .from("tool_changelog")
    .insert({ release_date: releaseDate, title, description, created_by: userId });

  if (error) {
    redirect(`/changements?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/changements?saved=1");
}

/**
 * Suppression réelle (pas d'archivage) réservée à l'admin — pas de donnée
 * personnelle dans cette table, mais on garde la même discipline que pour
 * les autres tables de gestion (DELETE jamais pour coordinator).
 */
export async function deleteChangelogEntry(entryId: string) {
  const { supabase, role } = await requireCoordinatorOrAdmin();

  if (role !== "admin") {
    redirect(`/changements?error=${encodeURIComponent("Seul un administrateur peut supprimer une entrée.")}`);
  }

  const { error } = await supabase.from("tool_changelog").delete().eq("id", entryId);

  if (error) {
    redirect(`/changements?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/changements?saved=1");
}
