"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Consomme le jeton envoyé par e-mail. Déclenchée uniquement par un clic
 * explicite (Server Action = requête POST), jamais par le simple chargement
 * de la page : les jetons Supabase sont à usage unique, et de nombreux
 * clients e-mail (aperçus de lien Gmail, Safe Links Outlook, scanners de
 * sécurité) suivent automatiquement les liens GET des e-mails pour les
 * vérifier, ce qui consomme silencieusement le jeton avant le vrai clic de
 * l'utilisateur. Voir README.md « Authentification ».
 */
export async function confirmSignIn(formData: FormData) {
  const token_hash = formData.get("token_hash");
  const type = formData.get("type") as EmailOtpType | null;
  const code = formData.get("code");
  const next = String(formData.get("next") ?? "/");

  const supabase = await createClient();

  if (typeof token_hash === "string" && token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  } else if (typeof code === "string" && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=lien_invalide");
}
