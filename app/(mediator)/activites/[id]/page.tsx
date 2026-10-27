import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";
import { ArchiveButton } from "./ArchiveButton";
import { archiveActivity } from "./actions";
import { SuccessBanner } from "@/components/forms/SuccessBanner";

const ACTIVITY_TYPE_LABELS = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const STATUS_LABELS: Record<string, string> = {
  en_cours: "En cours",
  a_completer: "À compléter",
  cloturee: "Clôturée",
};

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Depuis la V2, une action peut être vue par son créateur, un participant,
 * ou coordinateur/admin (RLS, 0007_v2_activity_flow.sql) — plus seulement
 * son créateur. Pas de filtre mediator_id ici, RLS fait déjà le tri.
 *
 * Une action en_cours redirige directement vers /terrain (pas encore
 * d'heure de fin) ; a_completer propose de clôturer, cloturee propose de
 * modifier — même écran /cloture dans les deux cas, guard_activity_update
 * n'interdit la modification des champs de clôture qu'au-delà de
 * mediator_id/archived_at (PRD V2, Étape 12). Les compteurs/freins restent
 * modifiables depuis /terrain quel que soit le statut.
 */
export default async function ActiviteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;

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
      "id, mediator_id, activity_date, campus, activity_type, status, people_reached, meaningful_conversations, interested_people, orientations_in_person, orientations_remote, archived_at",
    )
    .eq("id", id)
    .single();

  if (!activity) {
    notFound();
  }

  if (activity.status === "en_cours") {
    redirect(`/activites/${id}/terrain`);
  }

  const [{ count: legacyOrientationsCount }, { data: barrierRows }] = await Promise.all([
    supabase
      .from("orientations")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", id)
      .is("archived_at", null),
    supabase
      .from("activity_barriers")
      .select("occurrences, barriers(label)")
      .eq("activity_id", id)
      .is("archived_at", null),
  ]);

  const barrierEntries = (
    (barrierRows ?? []) as unknown as { occurrences: number; barriers: { label: string } | null }[]
  ).filter((row) => row.barriers?.label);

  const isArchived = Boolean(activity.archived_at);
  const isCreator = activity.mediator_id === user.id;

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

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        {isArchived && (
          <p className="rounded-lg bg-card-alt p-3 text-sm text-text-muted">
            Cette activité a été archivée le {formatDate(activity.archived_at!.slice(0, 10))} —
            exclue des statistiques, conservée en historique.
          </p>
        )}

        {!isArchived && activity.status === "a_completer" && (
          <Link
            href={`/activites/${id}/cloture`}
            className="block rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
          >
            Compléter et clôturer l&apos;action
          </Link>
        )}

        {!isArchived && activity.status === "cloturee" && (
          <Link
            href={`/activites/${id}/cloture`}
            className="block rounded-full border border-border bg-card px-5 py-3 text-center text-sm font-bold text-text-strong"
          >
            Modifier
          </Link>
        )}

        <dl className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
          <Row label="Date" value={formatDate(activity.activity_date)} />
          <Row label="Lieu / université" value={activity.campus} />
          <Row label="Statut" value={STATUS_LABELS[activity.status] ?? activity.status} />
          <Row label="Personnes atteintes" value={String(activity.people_reached)} />
          <Row label="Conversations significatives" value={String(activity.meaningful_conversations)} />
          <Row label="Personnes intéressées" value={String(activity.interested_people)} />
          <Row label="Orientations en personne" value={String(activity.orientations_in_person)} />
          <Row label="Orientations à distance" value={String(activity.orientations_remote)} />
          {(legacyOrientationsCount ?? 0) > 0 && (
            <Row label="Orientations liées (historique V1)" value={String(legacyOrientationsCount)} />
          )}
        </dl>

        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium text-text-strong">Freins entendus</span>
            <span className="text-text-strong">
              {barrierEntries.reduce((sum, row) => sum + row.occurrences, 0)}
            </span>
          </div>
          {barrierEntries.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {barrierEntries.map((row) => (
                <span
                  key={row.barriers!.label}
                  className="rounded-full bg-card-alt px-2.5 py-1 text-xs font-medium text-text-strong"
                >
                  {row.barriers!.label} × {row.occurrences}
                </span>
              ))}
            </div>
          )}
          {!isArchived && (
            <Link
              href={`/activites/${id}/terrain`}
              className="block rounded-full border border-dashed border-border bg-card-alt px-4 py-2 text-center text-sm font-bold text-bomoi-red"
            >
              Modifier les chiffres et les freins
            </Link>
          )}
        </div>

        {!isArchived && isCreator && (
          <div className="flex gap-3">
            <Link
              href={`/activites/${id}/terrain`}
              className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-center text-sm font-bold text-text-strong"
            >
              Reprendre sur le terrain
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
