import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { addChangelogEntry, deleteChangelogEntry } from "./actions";

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Seule page hors des deux zones (mediator)/(coordinator) : lue par tout
 * compte authentifié (médiateur compris — transparence sur l'évolution de
 * l'outil, repère temporel pour la recherche iCOMMS sur son adoption),
 * écrite par coordinateur/admin uniquement. Pas de BottomNav/layout ici
 * (route hors des deux groupes) — lien de retour générique vers « / »,
 * qui redirige déjà correctement selon le rôle (middleware).
 */
export default async function ChangementsPage({
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
  const canWrite = profile?.role === "coordinator" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  const { data: entries } = await supabase
    .from("tool_changelog")
    .select("id, release_date, title, description")
    .order("release_date", { ascending: false });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-page px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold text-text-strong">Nouveautés de l&apos;outil</h1>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        {canWrite && (
          <form action={addChangelogEntry} className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="font-bold text-text-strong">Ajouter une entrée</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="release_date" className="mb-1 block text-sm font-medium text-text-strong">
                  Date
                </label>
                <input
                  id="release_date"
                  name="release_date"
                  type="date"
                  required
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
                />
              </div>
              <div>
                <label htmlFor="title" className="mb-1 block text-sm font-medium text-text-strong">
                  Titre
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-text-strong">
                Description (facultatif)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                maxLength={1000}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
            >
              Ajouter
            </button>
          </form>
        )}

        <div className="space-y-3">
          {(entries ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-text-muted">
              Aucune nouveauté enregistrée pour l&apos;instant.
            </p>
          )}
          {(entries ?? []).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-bomoi-red">
                {formatDate(entry.release_date)}
              </p>
              <p className="mt-1 font-medium text-text-strong">{entry.title}</p>
              {entry.description && <p className="mt-1 text-text-secondary">{entry.description}</p>}
              {isAdmin && (
                <form action={deleteChangelogEntry.bind(null, entry.id)} className="mt-3">
                  <button type="submit" className="text-xs font-bold text-text-muted underline underline-offset-2">
                    Supprimer
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
