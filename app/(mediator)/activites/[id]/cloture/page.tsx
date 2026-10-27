import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";
import { ClotureForm } from "./ClotureForm";

const ACTIVITY_TYPE_LABELS = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * Une action en_cours n'a pas encore d'heure de fin (end_activity() pas
 * encore appelé) — elle ne peut être complétée qu'après être passée par
 * /terrain, même règle que la page de détail.
 */
export default async function CloturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: activity }, { data: barriers }, { data: misconceptions }] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, campus, activity_type, status, started_at, ended_at, period, audience, event_context, supports_used, worked_well, media_captured",
      )
      .eq("id", id)
      .single(),
    supabase.from("barriers").select("id, label, sort_order").order("sort_order"),
    supabase
      .from("activity_misconceptions")
      .select("id, content, barrier_id")
      .eq("activity_id", id)
      .is("archived_at", null)
      .order("created_at"),
  ]);

  if (!activity) {
    notFound();
  }

  if (activity.status === "en_cours") {
    redirect(`/activites/${id}/terrain`);
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/activites/${id}`}
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-text-strong">Clôturer l&apos;action</h1>
            <p className="truncate text-sm text-text-muted">
              {ACTIVITY_TYPE_LABELS[activity.activity_type] ?? activity.activity_type} · {activity.campus}
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <ClotureForm
          activityId={id}
          startedAt={activity.started_at}
          endedAt={activity.ended_at}
          initialPeriod={activity.period}
          initialAudience={activity.audience}
          initialEventContext={activity.event_context}
          initialSupportsUsed={activity.supports_used ?? []}
          initialWorkedWell={activity.worked_well ?? ""}
          initialMediaCaptured={activity.media_captured}
          barriers={(barriers ?? []).map((barrier) => ({ id: barrier.id, label: barrier.label }))}
          initialMisconceptions={misconceptions ?? []}
        />
      </div>
    </div>
  );
}
