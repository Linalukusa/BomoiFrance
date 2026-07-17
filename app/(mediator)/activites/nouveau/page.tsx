import Link from "next/link";
import { ActivityForm } from "../ActivityForm";
import { createActivity } from "./actions";

export default async function NouvelleActivitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
          <h1 className="text-xl font-bold text-text-strong">Nouvelle activité</h1>
        </div>

        {error && <p className="mb-4 text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <ActivityForm action={createActivity} />
      </div>
    </div>
  );
}
