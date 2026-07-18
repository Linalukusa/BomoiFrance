import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";
import { EfsLinkCard } from "./EfsLinkCard";

const ACTIVITY_TYPE_LABELS = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function ActivitesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let query = supabase
    .from("activities")
    .select("id, activity_date, campus, activity_type, people_reached, interested_people")
    .eq("mediator_id", user.id)
    .is("archived_at", null)
    .order("activity_date", { ascending: false });

  if (from) query = query.gte("activity_date", from);
  if (to) query = query.lte("activity_date", to);

  const { data: activities } = await query;

  const [{ data: orientedRows }, { data: barrieredRows }, { data: efsSlug }] = await Promise.all([
    supabase
      .from("orientations")
      .select("activity_id")
      .eq("mediator_id", user.id)
      .is("archived_at", null)
      .not("activity_id", "is", null),
    supabase.from("activity_barriers").select("activity_id").eq("mediator_id", user.id).is("archived_at", null),
    supabase.rpc("get_or_create_efs_link"),
  ]);

  const orientedActivityIds = new Set((orientedRows ?? []).map((row) => row.activity_id));
  const barrieredActivityIds = new Set((barrieredRows ?? []).map((row) => row.activity_id));

  const siteUrl = await getSiteUrl();
  const efsLink = typeof efsSlug === "string" && efsSlug.length > 0 ? `${siteUrl}/r/${efsSlug}` : null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-strong">Mes activités</h1>
        <Link
          href="/activites/nouveau"
          className="rounded-full bg-bomoi-red px-4 py-2 text-sm font-bold text-white"
        >
          + Nouvelle
        </Link>
      </div>

      {efsLink && <EfsLinkCard link={efsLink} />}

      <form method="get" className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="from" className="mb-1 block text-xs text-text-muted">
            Du
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="to" className="mb-1 block text-xs text-text-muted">
            Au
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text-strong"
        >
          Filtrer
        </button>
      </form>

      {!activities || activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="mb-4 text-sm text-text-muted">
            {from || to
              ? "Aucune activité ne correspond à cette période."
              : "Aucune activité enregistrée pour l'instant — créez la première."}
          </p>
          <Link
            href="/activites/nouveau"
            className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white"
          >
            Créer ma première activité
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => {
            const needsCompletion =
              (activity.interested_people > 0 && !orientedActivityIds.has(activity.id)) ||
              !barrieredActivityIds.has(activity.id);

            return (
              <li key={activity.id}>
                <Link
                  href={`/activites/${activity.id}`}
                  className="block rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate font-bold text-text-strong">
                      {ACTIVITY_TYPE_LABELS[activity.activity_type] ?? activity.activity_type}
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {formatDate(activity.activity_date)}
                    </span>
                  </div>
                  <p className="mb-2 truncate text-sm text-text-secondary">{activity.campus}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                    <span className="rounded-full bg-card-alt px-2 py-1">
                      {activity.people_reached} pers. atteintes
                    </span>
                    {activity.interested_people > 0 && (
                      <span className="rounded-full bg-card-alt px-2 py-1">
                        {activity.interested_people} intéressée
                        {activity.interested_people > 1 ? "s" : ""}
                      </span>
                    )}
                    {needsCompletion && (
                      <span className="rounded-full border border-dashed border-border px-2 py-1 text-text-muted">
                        À compléter
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
