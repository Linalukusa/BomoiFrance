"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Invitation d'un médiateur — réservée à coordinator/admin (SECURITY.md §3.2).
 * La permission est vérifiée avec le client lié à la session de l'appelant
 * (RLS s'applique) AVANT tout appel au client service_role, qui contourne RLS
 * par nature et ne doit jamais être atteignable sans ce contrôle préalable.
 */
export async function inviteMediator(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordinator" && profile?.role !== "admin") {
    redirect("/dashboard?error=non_autorise");
  }

  const email = String(formData.get("email") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const university = String(formData.get("university") ?? "").trim();

  if (!email || !firstName || !lastName || !university) {
    redirect("/mediateurs/nouveau?error=champs_manquants");
  }

  const admin = createAdminClient();
  const siteUrl = await getSiteUrl();

  // redirectTo n'est plus le mécanisme d'authentification (voir LoginForm.tsx :
  // connexion par code à 6 chiffres, pas par lien) — conservé uniquement comme
  // destination de repli si le modèle d'e-mail « Invite user » contient encore
  // un lien.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: siteUrl },
  );

  if (inviteError || !invited?.user) {
    redirect(
      `/mediateurs/nouveau?error=${encodeURIComponent(inviteError?.message ?? "invitation_impossible")}`,
    );
  }

  const newUserId = invited.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: newUserId, role: "mediator" });

  const { error: mediatorError } = profileError
    ? { error: profileError }
    : await admin.from("mediators").insert({
        id: newUserId,
        first_name: firstName,
        last_name: lastName,
        university,
      });

  if (profileError || mediatorError) {
    await admin.auth.admin.deleteUser(newUserId);
    redirect(
      `/mediateurs/nouveau?error=${encodeURIComponent(
        (profileError ?? mediatorError)?.message ?? "creation_impossible",
      )}`,
    );
  }

  redirect("/mediateurs/nouveau?success=1");
}
