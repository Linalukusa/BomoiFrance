import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

type BarrierRow = {
  activity_id: string;
  note: string | null;
  barriers: { label: string } | null;
  activities: { activity_date: string; campus: string; activity_type: string } | null;
};

type GroupedActivity = {
  activityDate: string;
  campus: string;
  activityType: string;
  labels: Set<string>;
  notes: Set<string>;
};

export default async function FreinsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rows } = await supabase
    .from("activity_barriers")
    .select("activity_id, note, barriers(label), activities(activity_date, campus, activity_type)")
    .eq("mediator_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const grouped = new Map<string, GroupedActivity>();

  for (const row of (rows ?? []) as unknown as BarrierRow[]) {
    if (!row.activities) continue;
    if (!grouped.has(row.activity_id)) {
      grouped.set(row.activity_id, {
        activityDate: row.activities.activity_date,
        campus: row.activities.campus,
        activityType: row.activities.activity_type,
        labels: new Set(),
        notes: new Set(),
      });
    }
    const entry = grouped.get(row.activity_id)!;
    if (row.barriers?.label) entry.labels.add(row.barriers.label);
    if (row.note) entry.notes.add(row.note);
  }

  const groupedEntries = [...grouped.entries()];

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-strong">Mes freins</h1>
        <Link
          href="/freins/nouveau"
          className="rounded-full bg-bomoi-red px-4 py-2 text-sm font-bold text-white"
        >
          + Nouveau
        </Link>
      </div>

      {groupedEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="mb-4 text-sm text-text-muted">Aucun frein enregistré pour l&apos;instant.</p>
          <Link
            href="/freins/nouveau"
            className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white"
          >
            Renseigner mon premier frein
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {groupedEntries.map(([activityId, entry]) => (
            <li key={activityId} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold text-text-strong">
                  {ACTIVITY_TYPE_LABELS[entry.activityType] ?? entry.activityType}
                </span>
                <span className="shrink-0 text-xs text-text-muted">{formatDate(entry.activityDate)}</span>
              </div>
              <p className="mb-2 truncate text-sm text-text-secondary">{entry.campus}</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[...entry.labels].map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-card-alt px-2.5 py-1 text-xs font-medium text-text-strong"
                  >
                    {label}
                  </span>
                ))}
              </div>
              {[...entry.notes].map((note) => (
                <p key={note} className="mb-1 text-xs text-text-muted">
                  {note}
                </p>
              ))}
              <Link
                href={`/activites/${activityId}`}
                className="mt-1 inline-block text-xs font-medium text-bomoi-red"
              >
                Voir l&apos;activité liée
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
