import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Point d'entrée unique pour tous les liens envoyés par e-mail par Supabase
 * Auth (connexion, invitation). Nécessite que les templates "Magic Link" et
 * "Invite user" du dashboard Supabase pointent explicitement vers
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}`
 * — ce n'est PAS le template par défaut (celui-ci utilise
 * `{{ .ConfirmationURL }}`, qui passe par le endpoint hébergé de Supabase et
 * revient avec les jetons dans un fragment d'URL, illisible côté serveur).
 * Voir README.md « Authentification ».
 *
 * Le paramètre `code` est géré en secours pour le flux PKCE, au cas où le
 * template enverrait un `code` plutôt qu'un `token_hash`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=lien_invalide`);
}
