import { redirect } from "next/navigation";

/**
 * Cette page ne devrait jamais être rendue en pratique : le middleware
 * redirige toujours "/" vers /login, /onboarding, /accueil ou /dashboard
 * selon l'état de connexion et le rôle. Filet de sécurité si jamais atteinte.
 */
export default function RootPage() {
  redirect("/login");
}
