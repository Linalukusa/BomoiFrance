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

export async function addMediaLogEntry(formData: FormData) {
  const { supabase, userId } = await requireCoordinatorOrAdmin();

  const mediaDate = formData.get("media_date") as string;
  const mediaType = formData.get("media_type") as string;
  const activityId = (formData.get("activity_id") as string) || null;
  const description = ((formData.get("description") as string) || "").trim().slice(0, 300) || null;
  const consentObtained = formData.get("consent_obtained") === "on";
  const externalLink = ((formData.get("external_link") as string) || "").trim().slice(0, 500) || null;

  if (!mediaDate || (mediaType !== "photo" && mediaType !== "video")) {
    redirect(`/medias?error=${encodeURIComponent("Merci de renseigner la date et le type.")}`);
  }

  const { error } = await supabase.from("media_log").insert({
    media_date: mediaDate,
    media_type: mediaType,
    activity_id: activityId,
    description,
    consent_obtained: consentObtained,
    external_link: externalLink,
    created_by: userId,
  });

  if (error) {
    redirect(`/medias?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/medias?saved=1");
}

export async function archiveMediaLogEntry(entryId: string) {
  const { supabase } = await requireCoordinatorOrAdmin();

  const { error } = await supabase
    .from("media_log")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) {
    redirect(`/medias?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/medias?saved=1");
}
