import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";
import { EfsLinkCard } from "./EfsLinkCard";

const ACTIVITY_TYPE_LABELS = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const STATUS_BADGE_LABELS: Record<string, string> = {
  en_cours: "En cours",
  a_completer: "À compléter",
};

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Depuis la V2, inclut les actions où le médiateur est participant, pas
 * seulement créateur (une action partagée doit apparaître dans la liste de
 * chacun de ses participants). Le badge "à compléter" se base désormais sur
 * `status`, plus sur la présence d'orientations/freins (Étape 11).
 */
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

  const { data: participantRows } = await supabase
    .from("activity_participants")
    .select("activity_id")
    .eq("mediator_id", user.id);

  const participantActivityIds = (participantRows ?? []).map((row) => row.activity_id);

  let query = supabase
    .from("activities")
    .select("id, activity_date, campus, activity_type, status, people_reached, interested_people")
    .is("archived_at", null)
    .order("activity_date", { ascending: false });

  query =
    participantActivityIds.length > 0
      ? query.or(`mediator_id.eq.${user.id},id.in.(${participantActivityIds.join(",")})`)
      : query.eq("mediator_id", user.id);

  if (from) query = query.gte("activity_date", from);
  if (to) query = query.lte("activity_date", to);

  const { data: activities } = await query;

  const { data: efsSlug } = await supabase.rpc("get_or_create_efs_link");

  const siteUrl = await getSiteUrl();
  const efsLink = typeof efsSlug === "string" && efsSlug.length > 0 ? `${siteUrl}/r/${efsSlug}` : null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-strong">Mes actions</h1>
        <Link
          href="/activites/nouveau"
          className="rounded-full bg-bomoi-red px-4 py-2 text-sm font-bold text-white"
        >
          + Démarrer
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
              ? "Aucune action ne correspond à cette période."
              : "Aucune action enregistrée pour l'instant — démarrez la première."}
          </p>
          <Link
            href="/activites/nouveau"
            className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white"
          >
            Démarrer ma première action
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => {
            const statusBadge = STATUS_BADGE_LABELS[activity.status];
            const href =
              activity.status === "en_cours"
                ? `/activites/${activity.id}/terrain`
                : `/activites/${activity.id}`;

            return (
              <li key={activity.id}>
                <Link href={href} className="block rounded-xl border border-border bg-card p-4">
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
                    {statusBadge && (
                      <span className="rounded-full border border-dashed border-border px-2 py-1 text-text-muted">
                        {statusBadge}
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
