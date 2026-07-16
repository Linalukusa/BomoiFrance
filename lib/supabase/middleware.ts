import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/confirm", "/auth/signout", "/api/health"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Rafraîchit la session Supabase sur chaque requête et applique les règles
 * de routage : connexion obligatoire, onboarding obligatoire pour les
 * médiateurs tant que la charte + le RGPD ne sont pas acceptés, séparation
 * des zones médiateur / coordinateur-admin. Voir ARCHITECTURE.md §4.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Court-circuit avant toute création de client : /api/health en particulier
  // doit rester indépendant de la disponibilité/configuration de Supabase.
  if (isPublicPath(pathname)) {
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

  const isMediator = profile.role === "mediator";

  if (isMediator) {
    const { data: mediator } = await supabase
      .from("mediators")
      .select("charter_accepted_at, privacy_accepted_at")
      .eq("id", user.id)
      .single();

    const onboarded = Boolean(mediator?.charter_accepted_at && mediator?.privacy_accepted_at);

    if (!onboarded && pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    if (onboarded && (pathname === "/onboarding" || pathname === "/")) {
      return NextResponse.redirect(new URL("/accueil", request.url));
    }
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/mediateurs")) {
      return NextResponse.redirect(new URL("/accueil", request.url));
    }
  } else {
    if (pathname === "/" || pathname === "/onboarding") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (pathname.startsWith("/accueil")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}
