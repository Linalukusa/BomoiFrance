import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/SignOutButton";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";

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

/**
 * Ordre d'affichage V2 (Étape 11) : En cours → À compléter → activité
 * récente. "À compléter" renvoie vers le détail de l'action (qui explique
 * l'état en attendant l'écran de clôture, Étape 12) plutôt que vers
 * /cloture, qui n'existe pas encore.
 */
export default async function AccueilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: mediator } = await supabase
    .from("mediators")
    .select("first_name")
    .eq("id", user.id)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isCoordinatorOrAdmin = profile?.role === "coordinator" || profile?.role === "admin";

  const { data: participantRows } = await supabase
    .from("activity_participants")
    .select("activity_id")
    .eq("mediator_id", user.id);
  const participantActivityIds = (participantRows ?? []).map((row) => row.activity_id);

  const ownershipClause =
    participantActivityIds.length > 0
      ? `mediator_id.eq.${user.id},id.in.(${participantActivityIds.join(",")})`
      : `mediator_id.eq.${user.id}`;

  const activityFields =
    "id, activity_date, campus, activity_type, people_reached, interested_people";

  const [{ data: inProgressActivities }, { data: toCompleteActivities }, { data: recentActivities }] =
    await Promise.all([
      supabase
        .from("activities")
        .select(activityFields)
        .eq("status", "en_cours")
        .is("archived_at", null)
        .or(ownershipClause)
        .order("activity_date", { ascending: false }),
      supabase
        .from("activities")
        .select(activityFields)
        .eq("status", "a_completer")
        .is("archived_at", null)
        .or(ownershipClause)
        .order("activity_date", { ascending: false }),
      supabase
        .from("activities")
        .select(activityFields)
        .eq("mediator_id", user.id)
        .eq("status", "cloturee")
        .is("archived_at", null)
        .order("activity_date", { ascending: false })
        .limit(2),
    ]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted">Bonjour</p>
          <p className="text-2xl font-bold text-text-strong">
            {mediator?.first_name ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isCoordinatorOrAdmin && (
            <Link
              href="/dashboard"
              className="text-sm text-text-muted underline underline-offset-2"
            >
              Vue coordinateur
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      <div className="space-y-3">
        <Link
          href="/activites/nouveau"
          className="block rounded-xl bg-ink p-4 text-white"
        >
          <p className="font-bold">Démarrer une action</p>
          <p className="text-sm text-white/70">Lieu, type — et c&apos;est parti</p>
        </Link>

        <Link
          href="/statistiques"
          className="block rounded-xl border border-border bg-card p-4"
        >
          <p className="font-bold text-text-strong">Mes statistiques</p>
          <p className="text-sm text-text-muted">Mon activité, mes freins, ma progression</p>
        </Link>
      </div>

      {inProgressActivities && inProgressActivities.length > 0 && (
        <ActivitySection
          title="En cours"
          activities={inProgressActivities}
          hrefFor={(id) => `/activites/${id}/terrain`}
          actionLabel="Reprendre"
        />
      )}

      {toCompleteActivities && toCompleteActivities.length > 0 && (
        <ActivitySection
          title="À compléter"
          activities={toCompleteActivities}
          hrefFor={(id) => `/activites/${id}`}
          actionLabel="Compléter"
        />
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-text-strong">Mon activité récente</h2>
          {recentActivities && recentActivities.length > 0 && (
            <Link href="/activites" className="text-sm text-bomoi-red">
              Tout voir
            </Link>
          )}
        </div>

        {!recentActivities || recentActivities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="mb-4 text-sm text-text-muted">
              Aucune action terminée pour l&apos;instant — démarrez la première.
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
            {recentActivities.map((activity) => (
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
                  <div className="flex gap-2 text-xs text-text-muted">
                    <span className="rounded-full bg-card-alt px-2 py-1">
                      {activity.people_reached} pers. atteintes
                    </span>
                    {activity.interested_people > 0 && (
                      <span className="rounded-full bg-card-alt px-2 py-1">
                        {activity.interested_people} intéressée
                        {activity.interested_people > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActivitySection({
  title,
  activities,
  hrefFor,
  actionLabel,
}: {
  title: string;
  activities: { id: string; activity_date: string; campus: string; activity_type: string }[];
  hrefFor: (id: string) => string;
  actionLabel: string;
}) {
  return (
    <div>
      <h2 className="mb-3 font-bold text-text-strong">{title}</h2>
      <ul className="space-y-3">
        {activities.map((activity) => (
          <li key={activity.id}>
            <Link
              href={hrefFor(activity.id)}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text-strong">
                  {ACTIVITY_TYPE_LABELS[activity.activity_type] ?? activity.activity_type}
                </p>
                <p className="truncate text-sm text-text-muted">
                  {activity.campus} — {formatDate(activity.activity_date)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-bomoi-red px-4 py-2 text-sm font-bold text-white">
                {actionLabel}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
