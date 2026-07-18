"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mediatorSchema } from "@/lib/validation/mediator";
import { PROFILE_ROLE_OPTIONS } from "@/lib/config/options";

const ROLE_VALUES = PROFILE_ROLE_OPTIONS.map((option) => option.value);

/**
 * Vérifié avec le client lié à la session de l'appelant (RLS s'applique)
 * AVANT tout appel au client service_role — même logique que
 * mediateurs/nouveau/actions.ts.
 */
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

  return { supabase, userId: user.id, role: profile.role };
}

/**
 * Édition "hors rôle" (PRD §4.6) : ce formulaire ne touche jamais
 * profiles.role — mediators_update_coordinator (RLS) autorise déjà
 * coordinator/admin à modifier ces champs, aucune vérification
 * supplémentaire n'est nécessaire ici au-delà de l'appartenance au rôle.
 */
export async function updateMediator(mediatorId: string, formData: FormData) {
  const { supabase } = await requireCoordinatorOrAdmin();

  const parsed = mediatorSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(
      `/mediateurs/${mediatorId}?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Formulaire invalide.",
      )}`,
    );
  }

  const languages = (parsed.data.languages ?? "")
    .split(",")
    .map((language) => language.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("mediators")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      university: parsed.data.university,
      status: parsed.data.status,
      availability: parsed.data.availability || null,
      languages,
    })
    .eq("id", mediatorId);

  if (error) {
    redirect(`/mediateurs/${mediatorId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/mediateurs/${mediatorId}?saved=1`);
}

/**
 * Changement de rôle : jamais une simple mise à jour de table — passe
 * exclusivement par la RPC set_user_role (SECURITY DEFINER), qui revérifie
 * is_admin() en interne et journalise dans audit_logs (SECURITY.md). La
 * vérification ci-dessous n'est qu'une première ligne de défense pour un
 * message d'erreur clair côté UI ; la RPC reste la seule garantie réelle.
 */
export async function changeRole(mediatorId: string, formData: FormData) {
  const { supabase, userId, role } = await requireCoordinatorOrAdmin();

  if (role !== "admin") {
    redirect(
      `/mediateurs/${mediatorId}?error=${encodeURIComponent("Seul un administrateur peut modifier un rôle.")}`,
    );
  }

  if (mediatorId === userId) {
    redirect(
      `/mediateurs/${mediatorId}?error=${encodeURIComponent(
        "Vous ne pouvez pas modifier votre propre rôle depuis cet écran.",
      )}`,
    );
  }

  const newRole = formData.get("role") as string;

  if (!ROLE_VALUES.includes(newRole as (typeof ROLE_VALUES)[number])) {
    redirect(`/mediateurs/${mediatorId}?error=${encodeURIComponent("Rôle invalide.")}`);
  }

  const { error } = await supabase.rpc("set_user_role", { p_user_id: mediatorId, p_new_role: newRole });

  if (error) {
    redirect(`/mediateurs/${mediatorId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/mediateurs/${mediatorId}?saved=1`);
}

/**
 * Suppression définitive (PRD §4.6) : réservée à l'admin, double
 * confirmation côté UI (DeleteAccountButton) + revérifiée ici (mot
 * "SUPPRIMER" recopié). Un seul appel service_role suffit :
 * auth.admin.deleteUser() supprime la ligne auth.users, ce qui déclenche en
 * cascade (ON DELETE CASCADE) la suppression de profiles, mediators,
 * activities, orientations, activity_barriers, link_clicks — chacune de ces
 * suppressions déclenche à son tour le trigger log_hard_delete()
 * (SECURITY.md), journalisant l'opération dans audit_logs.
 */
export async function deleteMediatorAccount(mediatorId: string, formData: FormData) {
  const { userId, role } = await requireCoordinatorOrAdmin();

  if (role !== "admin") {
    redirect(
      `/mediateurs/${mediatorId}?error=${encodeURIComponent("Seul un administrateur peut supprimer un compte.")}`,
    );
  }

  if (mediatorId === userId) {
    redirect(
      `/mediateurs/${mediatorId}?error=${encodeURIComponent(
        "Vous ne pouvez pas supprimer votre propre compte depuis cet écran.",
      )}`,
    );
  }

  const confirmation = formData.get("confirmation") as string;

  if (confirmation !== "SUPPRIMER") {
    redirect(`/mediateurs/${mediatorId}?error=${encodeURIComponent("Confirmation incorrecte.")}`);
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(mediatorId);

  if (error) {
    redirect(`/mediateurs/${mediatorId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/mediateurs?deleted=1");
}
