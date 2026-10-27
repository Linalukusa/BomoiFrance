import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CAMPUS_OPTIONS } from "@/lib/config/options";
import { StartActivityForm } from "./StartActivityForm";
import { startActivity } from "./actions";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * « Démarrer une action » — objectif : moins de 5 secondes sur le terrain
 * (PRD V2, Étape 11). Pas de chiffres saisis ici : ils se tapent sur l'écran
 * terrain une fois l'action créée.
 */
export default async function NouvelleActivitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: lastActivity }, { data: mediatorRecord }, { data: collections }, { data: peers }] =
    await Promise.all([
      supabase
        .from("activities")
        .select("campus")
        .eq("mediator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("mediators").select("university").eq("id", user.id).single(),
      supabase
        .from("aggregate_collection_results")
        .select("id, collection_date, location")
        .is("archived_at", null)
        .gte("collection_date", todayISODate())
        .order("collection_date", { ascending: true }),
      supabase.rpc("list_active_mediators"),
    ]);

  let defaultCampus: string = CAMPUS_OPTIONS[0];
  if (lastActivity?.campus) {
    defaultCampus = lastActivity.campus;
  } else if (
    mediatorRecord?.university &&
    (CAMPUS_OPTIONS as readonly string[]).includes(mediatorRecord.university)
  ) {
    defaultCampus = mediatorRecord.university;
  }

  const collectionOptions = (collections ?? []).map((collection) => ({
    id: collection.id,
    label: `${new Date(`${collection.collection_date}T00:00:00`).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    })} – ${collection.location}`,
  }));

  const peerOptions = ((peers ?? []) as { id: string; first_name: string; last_name: string }[]).map(
    (peer) => ({
      value: peer.id,
      label: `${peer.first_name} ${peer.last_name.charAt(0)}.`,
    }),
  );

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/activites"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold text-text-strong">Démarrer une action</h1>
        </div>

        {error && <p className="mb-4 text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <StartActivityForm
          action={startActivity}
          defaultCampus={defaultCampus}
          collections={collectionOptions}
          peerMediators={peerOptions}
        />
      </div>
    </div>
  );
}
