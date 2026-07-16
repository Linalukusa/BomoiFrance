import { headers } from "next/headers";

/**
 * URL publique du site, utilisée pour construire les liens de redirection
 * envoyés par e-mail (invitation, connexion). Préférer NEXT_PUBLIC_SITE_URL
 * en production ; à défaut, déduite de l'en-tête Host de la requête (utile
 * en local/preview).
 */
export async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
