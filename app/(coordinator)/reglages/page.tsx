import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { updateAppSettings } from "./actions";

/**
 * Admin uniquement — un coordinateur peut lire app_settings (RLS,
 * app_settings_select) mais pas cet écran d'écriture (même logique que
 * /collectes : lecture possible, écriture réservée à l'admin).
 */
export default async function ReglagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    redirect("/dashboard?error=non_autorise");
  }

  const { data: settings } = await supabase
    .from("app_settings")
    .select("research_collection_enabled")
    .eq("id", true)
    .single();

  return (
    <div className="flex flex-1 flex-col px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold text-text-strong">Réglages</h1>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <form action={updateAppSettings} className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-bold text-text-strong">Recherche iCOMMS</h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            Active le journal de bord et les questionnaires de recherche sur l&apos;usage de l&apos;outil —
            à n&apos;activer qu&apos;après approbation du comité d&apos;éthique UCT/iCOMMS. N&apos;affecte
            jamais les médiateurs n&apos;ayant pas donné leur consentement recherche.
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-text-strong">
            <input
              type="checkbox"
              name="research_collection_enabled"
              defaultChecked={settings?.research_collection_enabled ?? false}
              className="h-4 w-4"
            />
            Activer la collecte de données de recherche
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
          >
            Enregistrer
          </button>
        </form>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-1 font-bold text-text-strong">Export recherche (iCOMMS)</h2>
          <p className="mb-3 text-sm leading-relaxed text-text-secondary">
            Fichier CSV pseudonymisé (code de recherche à la place de l&apos;identité) — ne contient que
            les médiateurs ayant un consentement recherche actif, jamais les autres.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route de téléchargement de fichier, pas une page */}
          <a
            href="/api/export/usage"
            className="block rounded-full border border-dashed border-border bg-card-alt px-4 py-3 text-center text-sm font-bold text-bomoi-red"
          >
            Télécharger les métriques d&apos;usage (CSV)
          </a>
        </div>
      </div>
    </div>
  );
}
