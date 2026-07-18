import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/signout", "/api/health", "/r"];
const MEDIATOR_AREA_PATHS = ["/accueil", "/activites", "/freins", "/statistiques", "/onboarding"];
const COORDINATOR_AREA_PATHS = ["/dashboard", "/mediateurs"];

function matchesPath(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Rafraîchit la session Supabase sur chaque requête et applique les règles
 * de routage. Voir ARCHITECTURE.md §4.
 *
 * Un compte a un rôle principal (`profiles.role`) qui donne ou non accès à
 * la zone coordinateur/admin, ET indépendamment peut avoir une fiche
 * `mediators` qui donne accès à la zone médiateur (charte + RGPD à jour) —
 * un coordinateur qui va aussi sur le terrain a les deux, un médiateur
 * "simple" n'a que la seconde.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Court-circuit avant toute création de client : /api/health en particulier
  // doit rester indépendant de la disponibilité/configuration de Supabase.
  if (matchesPath(pathname, PUBLIC_PATHS)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (pas getSession()) : seul appel qui revalide le JWT auprès de Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL("/login?error=profil_introuvable", request.url));
  }

  const isCoordinatorOrAdmin = profile.role === "coordinator" || profile.role === "admin";

  const { data: mediatorRecord } = await supabase
    .from("mediators")
    .select("charter_accepted_at, privacy_accepted_at")
    .eq("id", user.id)
    .maybeSingle();

  const hasMediatorCapability = Boolean(mediatorRecord);
  const mediatorOnboarded = Boolean(
    mediatorRecord?.charter_accepted_at && mediatorRecord?.privacy_accepted_at,
  );

  if (pathname === "/") {
    if (isCoordinatorOrAdmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (hasMediatorCapability) {
      return NextResponse.redirect(
        new URL(mediatorOnboarded ? "/accueil" : "/onboarding", request.url),
      );
    }
    return NextResponse.redirect(new URL("/login?error=profil_introuvable", request.url));
  }

  if (matchesPath(pathname, MEDIATOR_AREA_PATHS)) {
    if (!hasMediatorCapability) {
      return NextResponse.redirect(
        new URL(isCoordinatorOrAdmin ? "/dashboard" : "/login", request.url),
      );
    }
    if (!mediatorOnboarded && pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    if (mediatorOnboarded && pathname === "/onboarding") {
      return NextResponse.redirect(new URL("/accueil", request.url));
    }
    return response;
  }

  if (matchesPath(pathname, COORDINATOR_AREA_PATHS)) {
    if (!isCoordinatorOrAdmin) {
      return NextResponse.redirect(
        new URL(hasMediatorCapability ? "/accueil" : "/login", request.url),
      );
    }
    return response;
  }

  return response;
}
