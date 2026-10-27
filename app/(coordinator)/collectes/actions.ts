"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
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

  return { supabase, isAdmin: profile.role === "admin" };
}

/**
 * Créée avant la collecte, compteurs encore NULL (RLS: collections_write_admin,
 * 0001) — un coordinateur voit cette liste mais ne peut jamais y écrire.
 */
export async function addCollection(formData: FormData) {
  const { supabase, isAdmin } = await requireAdmin();

  if (!isAdmin) {
    redirect(`/collectes?error=${encodeURIComponent("Seul un administrateur peut créer une collecte.")}`);
  }

  const collectionDate = formData.get("collection_date") as string;
  const location = ((formData.get("location") as string) || "").trim();

  if (!collectionDate || !location) {
    redirect(`/collectes?error=${encodeURIComponent("Merci de renseigner la date et le lieu.")}`);
  }

  const { error } = await supabase
    .from("aggregate_collection_results")
    .insert({ collection_date: collectionDate, location });

  if (error) {
    redirect(`/collectes?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/collectes?saved=1");
}

/**
 * Jamais déduits ou estimés par l'application (comment sur la table,
 * 0001) : les deux compteurs ne se saisissent qu'ici, après retour
 * officiel EFS.
 */
export async function updateCollectionResults(collectionId: string, formData: FormData) {
  const { supabase, isAdmin } = await requireAdmin();

  if (!isAdmin) {
    redirect(`/collectes/${collectionId}?error=${encodeURIComponent("Seul un administrateur peut saisir ces résultats.")}`);
  }

  const donorsRaw = formData.get("donors_count") as string;
  const firstTimeRaw = formData.get("first_time_donors_count") as string;
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  const donorsCount = donorsRaw ? Number(donorsRaw) : null;
  const firstTimeDonorsCount = firstTimeRaw ? Number(firstTimeRaw) : null;

  const { error } = await supabase
    .from("aggregate_collection_results")
    .update({ donors_count: donorsCount, first_time_donors_count: firstTimeDonorsCount, notes })
    .eq("id", collectionId);

  if (error) {
    redirect(`/collectes/${collectionId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/collectes/${collectionId}?saved=1`);
}

export async function archiveCollection(collectionId: string) {
  const { supabase, isAdmin } = await requireAdmin();

  if (!isAdmin) {
    redirect(`/collectes/${collectionId}?error=${encodeURIComponent("Seul un administrateur peut archiver une collecte.")}`);
  }

  const { error } = await supabase
    .from("aggregate_collection_results")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", collectionId);

  if (error) {
    redirect(`/collectes/${collectionId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/collectes?saved=1");
}
