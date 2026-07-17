import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrientationForm } from "../OrientationForm";
import { createOrientation } from "./actions";

export default async function NouvelleOrientationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; activity_id?: string }>;
}) {
  const { error, activity_id } = await searchParams;
  const supabase = await createClient();

  const { data: collections } = await supabase
    .from("aggregate_collection_results")
    .select("id, collection_date, location")
    .is("archived_at", null)
    .order("collection_date", { ascending: false });

  const collectionOptions = (collections ?? []).map((collection) => ({
    id: collection.id,
    label: `${new Date(collection.collection_date).toLocaleDateString("fr-FR")} – ${collection.location}`,
  }));

  const backHref = activity_id ? `/activites/${activity_id}` : "/orientations";

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href={backHref}
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold text-text-strong">Nouvelle orientation</h1>
        </div>

        {error && <p className="mb-4 text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <OrientationForm action={createOrientation} activityId={activity_id} collections={collectionOptions} />
      </div>
    </div>
  );
}
