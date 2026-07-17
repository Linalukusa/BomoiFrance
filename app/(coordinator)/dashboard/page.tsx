import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: mediatorRecord } = user
    ? await supabase.from("mediators").select("id").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-bomoi-red">
            BOMOI · Toulouse
          </p>
          <h1 className="text-2xl font-bold text-text-strong">
            Tableau de bord coordinateur
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {mediatorRecord && (
            <Link href="/accueil" className="text-sm text-text-muted underline underline-offset-2">
              Vue médiateur
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      <Link
        href="/mediateurs/nouveau"
        className="w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white"
      >
        + Inviter un médiateur
      </Link>

      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
        Les sections Objectifs, Indicateurs d&apos;impact, Répartitions,
        Résultats de collecte et Fiabilité des données arrivent à
        l&apos;Étape 8 du plan de développement.
      </div>
    </div>
  );
}
