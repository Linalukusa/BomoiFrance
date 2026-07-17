/**
 * Traduit les messages d'erreur Supabase Auth (toujours en anglais côté API)
 * pour respecter l'exigence d'interface entièrement en français (PRD §8).
 * Repli sur un message générique si le texte n'est pas reconnu.
 */
export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("security purposes") || lower.includes("rate limit")) {
    const seconds = message.match(/(\d+) seconds?/)?.[1];
    return seconds
      ? `Pour des raisons de sécurité, merci de patienter ${seconds} secondes avant de redemander un lien.`
      : "Pour des raisons de sécurité, merci de patienter quelques instants avant de redemander un lien.";
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "Adresse e-mail invalide.";
  }
  if (lower.includes("user not found") || lower.includes("signups not allowed")) {
    return "Aucun compte ne correspond à cette adresse. Utilisez l'e-mail transmis par votre coordinateur.";
  }

  return "Une erreur est survenue, merci de réessayer.";
}

export const AUTH_QUERY_ERROR_MESSAGES: Record<string, string> = {
  lien_invalide: "Ce lien de connexion n'est plus valide. Merci d'en redemander un.",
  profil_introuvable: "Aucun profil n'est associé à ce compte. Contactez votre coordinateur.",
};
