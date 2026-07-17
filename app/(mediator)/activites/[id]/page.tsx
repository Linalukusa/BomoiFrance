import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_TYPE_OPTIONS, DURATION_OPTIONS } from "@/lib/config/options";
import { ActivityForm } from "../ActivityForm";
import { ArchiveButton } from "./ArchiveButton";
import { updateActivity, archiveActivity } from "./actions";

const ACTIVITY_TYPE_LABELS = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);
const DURATION_LABELS = Object.fromEntries(
  DURATION_OPTIONS.map((option) => [option.value, option.label]),
);

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function ActiviteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const { id } = await params;
  const { edit, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: activity } = await supabase
    .from("activities")
    .select(
      "id, activity_date, campus, activity_type, people_reached, meaningful_conversations, interested_people, support_used, duration, note, archived_at",
    )
    .eq("id", id)
    .eq("mediator_id", user.id)
    .single();

  if (!activity) {
    notFound();
  }

  const isArchived = Boolean(activity.archived_at);
  const isEditing = edit === "1" && !isArchived;

  if (isEditing) {
    return (
      <div className="flex flex-1 flex-col px-6 py-6">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4 flex items-center gap-3">
            <Link
              href={`/activites/${id}`}
              aria-label="Annuler"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
            >
              ‹
            </Link>
            <h1 className="text-xl font-bold text-text-strong">Modifier l&apos;activité</h1>
          </div>
          {error && <p className="mb-4 text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}
          <ActivityForm
            action={updateActivity.bind(null, id)}
            initialValues={{
              activity_date: activity.activity_date,
              campus: activity.campus,
              activity_type: activity.activity_type,
              people_reached: activity.people_reached,
              meaningful_conversations: activity.meaningful_conversations,
              interested_people: activity.interested_people,
              support_used: activity.support_used ?? "",
              duration: activity.duration ?? "",
              note: activity.note ?? "",
            }}
            submitLabel="Enregistrer les modifications"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/activites"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-text-strong">
            {ACTIVITY_TYPE_LABELS[activity.activity_type] ?? activity.activity_type}
          </h1>
        </div>

        {isArchived && (
          <p className="rounded-lg bg-card-alt p-3 text-sm text-text-muted">
            Cette activité a été archivée le {formatDate(activity.archived_at!.slice(0, 10))} —
            exclue des statistiques, conservée en historique.
          </p>
        )}

        <dl className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
          <Row label="Date" value={formatDate(activity.activity_date)} />
          <Row label="Lieu / université" value={activity.campus} />
          <Row
            label="Personnes atteintes"
            value={String(activity.people_reached)}
          />
          <Row
            label="Conversations significatives"
            value={String(activity.meaningful_conversations)}
          />
          <Row label="Personnes intéressées" value={String(activity.interested_people)} />
          {activity.support_used && <Row label="Support utilisé" value={activity.support_used} />}
          {activity.duration && (
            <Row label="Durée" value={DURATION_LABELS[activity.duration] ?? activity.duration} />
          )}
          {activity.note && <Row label="Note" value={activity.note} />}
        </dl>

        {!isArchived && (
          <div className="flex gap-3">
            <Link
              href={`/activites/${id}?edit=1`}
              className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-center text-sm font-bold text-text-strong"
            >
              Modifier
            </Link>
            <ArchiveButton action={archiveActivity.bind(null, id)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-text-strong">{value}</dd>
    </div>
  );
}
