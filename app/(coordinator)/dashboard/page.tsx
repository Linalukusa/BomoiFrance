import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/SignOutButton";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { MonthlyBarChart } from "@/components/dashboard/MonthlyBarChart";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { DEFINITIONS } from "@/lib/config/definitions";
import {
  OBJECTIVE_PEOPLE_REACHED,
  OBJECTIVE_NEW_DONORS_MIN,
  OBJECTIVE_NEW_DONORS_MAX,
} from "@/lib/config/objectives";
import { monthKey, lastSixMonths } from "@/lib/dashboard/months";

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function SectionHeading({ index, title }: { index: number; title: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
      Section {index} · {title}
    </p>
  );
}

/**
 * Layout desktop/tablette (PRD §4.8) — accessible uniquement coordinator/admin
 * (proxy). Toutes les données passent par les vues v_dashboard_* et
 * v_reliability (supabase/migrations/0006_dashboard_views.sql), qui filtrent
 * déjà archived_at IS NULL — jamais répété ici.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: mediatorRecord },
    { data: impact },
    { data: barrierRows },
    { data: campusRows },
    { data: reliability },
    { data: collections },
    { data: monthlyActivities },
  ] = await Promise.all([
    user ? supabase.from("mediators").select("id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("v_dashboard_impact").select("*").single(),
    supabase.from("v_dashboard_barriers").select("*"),
    supabase.from("v_dashboard_campus").select("*"),
    supabase.from("v_reliability").select("*").single(),
    supabase
      .from("aggregate_collection_results")
      .select("id, collection_date, location, donors_count, first_time_donors_count")
      .is("archived_at", null)
      .order("collection_date", { ascending: false }),
    supabase.from("activities").select("activity_date, people_reached").is("archived_at", null),
  ]);

  const peopleReached = impact?.people_reached ?? 0;
  const peopleReachedPct =
    OBJECTIVE_PEOPLE_REACHED > 0 ? Math.min(100, (peopleReached / OBJECTIVE_PEOPLE_REACHED) * 100) : 0;

  const newDonorsTotal = (collections ?? []).reduce((sum, c) => sum + (c.first_time_donors_count ?? 0), 0);
  const newDonorsPct =
    OBJECTIVE_NEW_DONORS_MAX > 0 ? Math.min(100, (newDonorsTotal / OBJECTIVE_NEW_DONORS_MAX) * 100) : 0;

  const retentionRate =
    impact && impact.mediators_recruited > 0 ? (impact.mediators_active / impact.mediators_recruited) * 100 : 0;
  const orientationRatio =
    impact && impact.interested_people > 0 ? (impact.orientations_count / impact.interested_people) * 100 : 0;

  const totalCampusActivities = (campusRows ?? []).reduce((sum, c) => sum + c.activities_count, 0);
  const barriersWithOccurrences = (barrierRows ?? []).filter((b) => b.occurrences > 0);
  const totalBarrierOccurrences = barriersWithOccurrences.reduce((sum, b) => sum + b.occurrences, 0);

  const months = lastSixMonths();
  const monthlyTotals = new Map(months.map((m) => [m.key, 0]));
  for (const activity of monthlyActivities ?? []) {
    const key = monthKey(activity.activity_date);
    if (monthlyTotals.has(key)) {
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + activity.people_reached);
    }
  }
  const monthlyData = months.map((m) => ({ label: m.label, value: monthlyTotals.get(m.key) ?? 0 }));

  const efsClicks = reliability?.efs_clicks ?? 0;
  const declaredOrientations = reliability?.declared_orientations ?? 0;
  const orientationsClicksGap = declaredOrientations - efsClicks;

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-bomoi-red">BOMOI · Toulouse</p>
            <h1 className="text-2xl font-bold text-text-strong">Tableau de bord coordinateur</h1>
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

        <div className="flex flex-wrap gap-3">
          <Link
            href="/mediateurs"
            className="w-fit rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-text-strong"
          >
            Médiateurs
          </Link>
          <Link
            href="/mediateurs/nouveau"
            className="w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white"
          >
            + Inviter un médiateur
          </Link>
        </div>

        <section className="space-y-3">
          <SectionHeading index={0} title="Objectifs vs réalisé" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-ink p-5 text-white">
              <div className="mb-1 flex items-center gap-1">
                <p className="text-sm text-white/70">Personnes sensibilisées</p>
                <InfoTooltip text={DEFINITIONS.personneSensibilisee} />
              </div>
              <p className="text-3xl font-bold">
                {peopleReached} <span className="text-base font-normal text-white/70">/ {OBJECTIVE_PEOPLE_REACHED}</span>
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-bomoi-red" style={{ width: `${peopleReachedPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-white/70">{Math.round(peopleReachedPct)}% de l&apos;objectif</p>
            </div>
            <div className="rounded-xl bg-ink p-5 text-white">
              <div className="mb-1 flex items-center gap-1">
                <p className="text-sm text-white/70">Nouveaux donneurs</p>
                <InfoTooltip text={DEFINITIONS.donRealise} />
              </div>
              <p className="text-3xl font-bold">
                {newDonorsTotal}{" "}
                <span className="text-base font-normal text-white/70">
                  / {OBJECTIVE_NEW_DONORS_MIN}–{OBJECTIVE_NEW_DONORS_MAX}
                </span>
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-bomoi-red" style={{ width: `${newDonorsPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-white/70">Saisi manuellement par l&apos;admin après retour officiel EFS</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading index={1} title="Indicateurs d'impact" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Médiateurs recrutés" value={impact?.mediators_recruited ?? 0} />
            <StatCard label="Médiateurs formés" value={impact?.mediators_trained ?? 0} />
            <StatCard label="Médiateurs actifs" value={impact?.mediators_active ?? 0} />
            <StatCard
              label="Taux de rétention"
              value={`${Math.round(retentionRate)}%`}
              tooltip="Médiateurs actifs / médiateurs recrutés."
            />
            <StatCard label="Activités menées" value={impact?.activities_count ?? 0} />
            <StatCard
              label="Personnes sensibilisées"
              value={peopleReached}
              tooltip={DEFINITIONS.personneSensibilisee}
            />
            <StatCard
              label="Conversations significatives"
              value={impact?.meaningful_conversations ?? 0}
              tooltip={DEFINITIONS.conversationSignificative}
            />
            <StatCard
              label="Personnes intéressées"
              value={impact?.interested_people ?? 0}
              tooltip={DEFINITIONS.personneInteressee}
            />
            <StatCard label="Orientations" value={impact?.orientations_count ?? 0} tooltip={DEFINITIONS.orientation} />
            <StatCard
              label="Ratio orientations / intéressés"
              value={`${Math.round(orientationRatio)}%`}
              tooltip="Orientations enregistrées / personnes intéressées."
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading index={2} title="Répartitions" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-bold text-text-strong">Activités par campus</h2>
              {(campusRows ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">Aucune activité enregistrée pour l&apos;instant.</p>
              ) : (
                <div className="space-y-3">
                  {(campusRows ?? []).map((c) => (
                    <ProgressBar
                      key={c.campus}
                      label={c.campus}
                      percentage={totalCampusActivities > 0 ? (c.activities_count / totalCampusActivities) * 100 : 0}
                      tooltip={`${c.activities_count} activité(s) sur ce campus.`}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-bold text-text-strong">Freins les plus fréquents</h2>
              {barriersWithOccurrences.length === 0 ? (
                <p className="text-sm text-text-muted">Aucun frein renseigné pour l&apos;instant.</p>
              ) : (
                <div className="space-y-3">
                  {barriersWithOccurrences
                    .slice()
                    .sort((a, b) => b.occurrences - a.occurrences)
                    .map((b) => (
                      <ProgressBar
                        key={b.barrier_id}
                        label={b.label}
                        percentage={totalBarrierOccurrences > 0 ? (b.occurrences / totalBarrierOccurrences) * 100 : 0}
                        tooltip="% calculé par occurrence de catégorie sur l'ensemble des freins renseignés par tous les médiateurs, pas par activité."
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-bold text-text-strong">Progression mensuelle</h2>
            <p className="mb-3 text-xs text-text-muted">
              Personnes sensibilisées, 6 derniers mois, tous médiateurs confondus
            </p>
            <MonthlyBarChart data={monthlyData} />
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading index={3} title="Résultats officiels des collectes" />
          <div className="rounded-xl border border-border bg-card p-4">
            {(collections ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">Aucune collecte enregistrée pour l&apos;instant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-xs uppercase text-text-muted">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Lieu</th>
                      <th className="pb-2 pr-4 font-medium">Donneurs</th>
                      <th className="pb-2 font-medium">Primo-donneurs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(collections ?? []).map((c) => (
                      <tr key={c.id} className="border-b border-border-subtle last:border-0">
                        <td className="py-2 pr-4 text-text-strong">{formatDate(c.collection_date)}</td>
                        <td className="py-2 pr-4 text-text-secondary">{c.location}</td>
                        <td className="py-2 pr-4 text-text-strong">{c.donors_count ?? "En attente"}</td>
                        <td className="py-2 text-text-strong">{c.first_time_donors_count ?? "En attente"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Saisie manuelle admin uniquement, après chaque collecte — jamais déduit ni estimé par l&apos;application.
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-dashed border-border p-5">
          <SectionHeading index={4} title="Fiabilité des données" />
          <p className="text-xs text-text-muted">
            Aide à identifier un besoin de formation, ne mesure jamais l&apos;impact du programme — à ne jamais
            mélanger aux indicateurs ci-dessus.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Clics sur liens EFS trackés"
              value={efsClicks}
              tooltip="Compteur anonyme cumulé de tous les liens courts EFS, tous médiateurs confondus. Aucune IP conservée."
            />
            <StatCard
              label="Écart orientations déclarées / clics"
              value={orientationsClicksGap}
              tooltip="Orientations déclarées par les médiateurs moins clics EFS enregistrés — un écart important peut signaler un besoin de formation sur la saisie, pas un problème d'impact."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
