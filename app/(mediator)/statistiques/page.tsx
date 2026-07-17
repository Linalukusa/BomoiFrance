import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { MonthlyBarChart } from "@/components/dashboard/MonthlyBarChart";
import { monthKey, lastSixMonths } from "@/lib/dashboard/months";

/**
 * Données strictement personnelles (PRD §4.7) : jamais de comparaison entre
 * médiateurs, jamais de classement — toutes les requêtes filtrent
 * mediator_id = auth.uid() (renforcé par RLS) et archived_at IS NULL.
 */
export default async function StatistiquesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: activities }, { count: orientationsTotal }, { data: barrierRows }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, activity_date, people_reached, meaningful_conversations, interested_people")
      .eq("mediator_id", user.id)
      .is("archived_at", null),
    supabase
      .from("orientations")
      .select("id", { count: "exact", head: true })
      .eq("mediator_id", user.id)
      .is("archived_at", null),
    supabase
      .from("activity_barriers")
      .select("barriers(label)")
      .eq("mediator_id", user.id)
      .is("archived_at", null),
  ]);

  const allActivities = activities ?? [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString().slice(0, 10);

  const totalActivities = allActivities.length;
  const last30DaysActivities = allActivities.filter((a) => a.activity_date >= thirtyDaysAgoIso).length;
  const peopleReached = allActivities.reduce((sum, a) => sum + a.people_reached, 0);
  const meaningfulConversations = allActivities.reduce((sum, a) => sum + a.meaningful_conversations, 0);
  const interestedPeople = allActivities.reduce((sum, a) => sum + a.interested_people, 0);

  const months = lastSixMonths();
  const monthlyTotals = new Map(months.map((m) => [m.key, 0]));
  for (const activity of allActivities) {
    const key = monthKey(activity.activity_date);
    if (monthlyTotals.has(key)) {
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + activity.people_reached);
    }
  }
  const monthlyData = months.map((m) => ({ label: m.label, value: monthlyTotals.get(m.key) ?? 0 }));

  const barrierCounts = new Map<string, number>();
  for (const row of (barrierRows ?? []) as unknown as { barriers: { label: string } | null }[]) {
    const label = row.barriers?.label;
    if (!label) continue;
    barrierCounts.set(label, (barrierCounts.get(label) ?? 0) + 1);
  }
  const totalBarrierOccurrences = [...barrierCounts.values()].reduce((sum, count) => sum + count, 0);
  const topBarriers = [...barrierCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({
      label,
      percentage: totalBarrierOccurrences > 0 ? (count / totalBarrierOccurrences) * 100 : 0,
    }));

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <div className="flex items-center gap-3">
        <Link
          href="/accueil"
          aria-label="Retour"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
        >
          ‹
        </Link>
        <h1 className="text-xl font-bold text-text-strong">Mes statistiques</h1>
      </div>

      <div className="rounded-xl bg-ink p-4 text-white">
        <p className="text-sm text-white/70">Activités réalisées</p>
        <p className="text-3xl font-bold">{totalActivities}</p>
        <p className="text-xs text-white/70">
          dont {last30DaysActivities} sur les 30 derniers jours
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Personnes sensibilisées" value={peopleReached} />
        <StatTile label="Conversations significatives" value={meaningfulConversations} />
        <StatTile label="Personnes intéressées" value={interestedPeople} />
        <StatTile label="Orientations enregistrées" value={orientationsTotal ?? 0} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-bold text-text-strong">Progression mensuelle</h2>
        <p className="mb-3 text-xs text-text-muted">Personnes sensibilisées, 6 derniers mois</p>
        <MonthlyBarChart data={monthlyData} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-bold text-text-strong">Mes freins les plus fréquents</h2>
        {topBarriers.length === 0 ? (
          <p className="text-sm text-text-muted">Aucun frein renseigné pour l&apos;instant.</p>
        ) : (
          <div className="space-y-3">
            {topBarriers.map((barrier) => (
              <ProgressBar
                key={barrier.label}
                label={barrier.label}
                percentage={barrier.percentage}
                tooltip="% calculé par occurrence de catégorie sur l'ensemble de mes freins renseignés, pas par activité."
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-2xl font-bold text-text-strong">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}
