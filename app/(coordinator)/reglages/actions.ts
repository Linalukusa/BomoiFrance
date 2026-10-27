"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * app_settings_update_admin (0010) revérifie déjà is_admin() côté base —
 * cette vérification applicative n'est qu'un message d'erreur clair.
 */
export async function updateAppSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    redirect("/dashboard?error=non_autorise");
  }

  const researchCollectionEnabled = formData.get("research_collection_enabled") === "on";

  const { error } = await supabase
    .from("app_settings")
    .update({ research_collection_enabled: researchCollectionEnabled })
    .eq("id", true);

  if (error) {
    redirect(`/reglages?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/reglages?saved=1");
}
