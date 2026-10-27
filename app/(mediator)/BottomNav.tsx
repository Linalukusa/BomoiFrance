"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// V2 : 3 onglets (Accueil, Actions, Mon parcours) — l'onglet Freins
// disparaît, le journal des freins se fait désormais depuis l'écran terrain
// d'une action (Étape 11). /parcours (dates d'engagement, heures cumulées,
// consentement recherche, attestation) remplace « Mes stats » dans la nav —
// les indicateurs d'impact personnels (PRD §4.7) restent accessibles via un
// lien depuis /parcours, pas doublés dans les deux écrans (Étape 13).
const TABS = [
  { href: "/accueil", label: "Accueil", icon: HomeIcon },
  { href: "/activites", label: "Actions", icon: ChatIcon },
  { href: "/parcours", label: "Mon parcours", icon: ChartIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex border-t border-border bg-card">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
              active ? "text-bomoi-red" : "text-text-muted"
            }`}
          >
            <Icon />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M4 5h16v11H8l-4 4V5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20h18" strokeLinecap="round" />
    </svg>
  );
}
