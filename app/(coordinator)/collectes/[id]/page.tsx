import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { ArchiveButton } from "./ArchiveButton";
import { updateCollectionResults, archiveCollection } from "../actions";

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function CollecteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
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

  const { data: collection } = await supabase
    .from("aggregate_collection_results")
    .select("id, collection_date, location, donors_count, first_time_donors_count, notes")
    .eq("id", id)
    .single();

  if (!collection) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/collectes"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text-strong">{collection.location}</h1>
            <p className="text-sm text-text-muted">{formatDate(collection.collection_date)}</p>
          </div>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        {isAdmin ? (
          <form
            action={updateCollectionResults.bind(null, id)}
            className="space-y-4 rounded-xl border border-border bg-card p-4"
          >
            <h2 className="font-bold text-text-strong">Résultats officiels EFS</h2>
            <p className="text-xs text-text-muted">
              Jamais déduits ou estimés par l&apos;application — saisie manuelle après retour officiel.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="donors_count" className="mb-1 block text-sm font-medium text-text-strong">
                  Donneurs
                </label>
                <input
                  id="donors_count"
                  name="donors_count"
                  type="number"
                  min={0}
                  defaultValue={collection.donors_count ?? ""}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
                />
              </div>
              <div>
                <label htmlFor="first_time_donors_count" className="mb-1 block text-sm font-medium text-text-strong">
                  Primo-donneurs
                </label>
                <input
                  id="first_time_donors_count"
                  name="first_time_donors_count"
                  type="number"
                  min={0}
                  defaultValue={collection.first_time_donors_count ?? ""}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="mb-1 block text-sm font-medium text-text-strong">
                Notes (facultatif)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={collection.notes ?? ""}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
            >
              Enregistrer
            </button>
          </form>
        ) : (
          <dl className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
            <Row label="Donneurs" value={collection.donors_count?.toString() ?? "À venir"} />
            <Row label="Primo-donneurs" value={collection.first_time_donors_count?.toString() ?? "À venir"} />
            {collection.notes && <Row label="Notes" value={collection.notes} />}
          </dl>
        )}

        {isAdmin && <ArchiveButton action={archiveCollection.bind(null, id)} />}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium text-text-strong">{value}</dd>
    </div>
  );
}
