import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { addCollection } from "./actions";

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Explicitement exclu de l'Étape 9 à la demande de BOMOI (gestion des
 * médiateurs) — construit seulement ici. RLS déjà en place depuis
 * 0001_init.sql : lecture ouverte à tout compte authentifié, écriture
 * admin uniquement (jamais déduit/estimé par l'application).
 */
export default async function CollectesPage({
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

  if (profile?.role !== "coordinator" && profile?.role !== "admin") {
    redirect("/dashboard?error=non_autorise");
  }

  const isAdmin = profile.role === "admin";

  const { data: collections } = await supabase
    .from("aggregate_collection_results")
    .select("id, collection_date, location, donors_count, first_time_donors_count")
    .is("archived_at", null)
    .order("collection_date", { ascending: false });

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold text-text-strong">Collectes EFS</h1>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        {isAdmin && (
          <form action={addCollection} className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="font-bold text-text-strong">Nouvelle collecte</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="collection_date" className="mb-1 block text-sm font-medium text-text-strong">
                  Date
                </label>
                <input
                  id="collection_date"
                  name="collection_date"
                  type="date"
                  required
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
                />
              </div>
              <div>
                <label htmlFor="location" className="mb-1 block text-sm font-medium text-text-strong">
                  Lieu
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  required
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
            >
              Créer
            </button>
          </form>
        )}

        <div className="space-y-3">
          {(collections ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-text-muted">
              Aucune collecte enregistrée pour l&apos;instant.
            </p>
          )}
          {(collections ?? []).map((collection) => {
            const hasResults = collection.donors_count !== null;
            return (
              <Link
                key={collection.id}
                href={`/collectes/${collection.id}`}
                className="block rounded-xl border border-border bg-card p-4 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-strong">{collection.location}</p>
                    <p className="text-text-muted">{formatDate(collection.collection_date)}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      hasResults ? "bg-card-alt text-text-strong" : "bg-ink text-white"
                    }`}
                  >
                    {hasResults ? `${collection.donors_count} donneur(s)` : "À venir"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
