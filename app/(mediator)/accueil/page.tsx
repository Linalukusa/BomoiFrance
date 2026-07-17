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

  const { data: recentActivities } = await supabase
    .from("activities")
    .select("id, activity_date, campus, activity_type, people_reached, interested_people")
    .eq("mediator_id", user.id)
    .is("archived_at", null)
    .order("activity_date", { ascending: false })
    .limit(2);

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
          <p className="font-bold">Nouvelle activité</p>
          <p className="text-sm text-white/70">Enregistrer une action de terrain</p>
        </Link>

        <Link
          href="/orientations"
          className="block rounded-xl border border-border bg-card p-4"
        >
          <p className="font-bold text-text-strong">Nouvelle orientation</p>
          <p className="text-sm text-text-muted">Vers une collecte EFS, sans identité</p>
        </Link>

        <Link href="/freins" className="block rounded-xl border border-border bg-card p-4">
          <p className="font-bold text-text-strong">Journal des freins</p>
          <p className="text-sm text-text-muted">Noter un frein rencontré</p>
        </Link>

        <Link
          href="/statistiques"
          className="block rounded-xl border border-border bg-card p-4"
        >
          <p className="font-bold text-text-strong">Mes statistiques</p>
          <p className="text-sm text-text-muted">Mon activité, mes freins, ma progression</p>
        </Link>
      </div>

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
              Aucune activité enregistrée pour l&apos;instant — créez la première.
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
