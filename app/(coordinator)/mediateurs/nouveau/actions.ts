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
 *
 * Un compte Supabase Auth = une seule adresse e-mail, mais `profiles.role`
 * (identité principale : coordinator/admin) et la présence d'une ligne
 * `mediators` (capacité médiateur, indépendante du rôle) sont deux choses
 * distinctes. Un coordinateur ou un admin qui va aussi sur le terrain
 * n'a donc pas besoin d'un second compte : on ajoute simplement une fiche
 * médiateur à son compte existant, sans jamais toucher à son rôle.
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

  const existingUserId = await findUserIdByEmail(admin, email);

  let userId: string;
  let createdNewAccount = false;

  if (existingUserId) {
    const { data: alreadyMediator } = await admin
      .from("mediators")
      .select("id")
      .eq("id", existingUserId)
      .maybeSingle();

    if (alreadyMediator) {
      redirect(
        `/mediateurs/nouveau?error=${encodeURIComponent(
          "Ce compte a déjà une fiche médiateur.",
        )}`,
      );
    }

    userId = existingUserId;
  } else {
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

    userId = invited.user.id;
    createdNewAccount = true;

    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: userId, role: "mediator" });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      redirect(
        `/mediateurs/nouveau?error=${encodeURIComponent(profileError.message)}`,
      );
    }
  }

  const { error: mediatorError } = await admin.from("mediators").insert({
    id: userId,
    first_name: firstName,
    last_name: lastName,
    university,
  });

  if (mediatorError) {
    // Rollback uniquement si on vient de créer le compte : un compte
    // coordinateur/admin préexistant ne doit jamais être supprimé ici.
    if (createdNewAccount) {
      await admin.auth.admin.deleteUser(userId);
    }
    redirect(
      `/mediateurs/nouveau?error=${encodeURIComponent(mediatorError.message)}`,
    );
  }

  redirect("/mediateurs/nouveau?success=1");
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  // L'équipe BOMOI est petite (dizaines de comptes, pas de milliers) :
  // une pagination simple suffit, pas besoin d'une recherche serveur dédiée.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;

    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match.id;

    if (data.users.length < perPage) return null;
    page += 1;
  }
}
