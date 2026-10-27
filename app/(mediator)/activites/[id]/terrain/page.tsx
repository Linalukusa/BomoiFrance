import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";
import { EfsLinkCard } from "../../EfsLinkCard";
import { TerrainCounters } from "./TerrainCounters";
import { endActivityAction } from "./actions";

const ACTIVITY_TYPE_LABELS = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

type ActivityBarrierRow = { barrier_id: string; occurrences: number };

export default async function TerrainPage({
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

  const [{ data: activity }, { data: barriers }, { data: barrierRows }, { data: slug }] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, campus, activity_type, status, people_reached, meaningful_conversations, interested_people, orientations_in_person, orientations_remote",
      )
      .eq("id", id)
      .single(),
    supabase.from("barriers").select("id, label, sort_order").order("sort_order"),
    supabase.from("activity_barriers").select("barrier_id, occurrences").eq("activity_id", id).is("archived_at", null),
    supabase.rpc("get_or_create_efs_link", { p_activity_id: id }),
  ]);

  if (!activity) {
    notFound();
  }

  const siteUrl = await getSiteUrl();
  const efsLink = typeof slug === "string" && slug.length > 0 ? `${siteUrl}/r/${slug}` : null;

  const initialBarrierCounts: Record<string, number> = {};
  for (const row of (barrierRows ?? []) as ActivityBarrierRow[]) {
    initialBarrierCounts[row.barrier_id] = row.occurrences;
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-md space-y-6 pb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/activites"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-text-strong">
              {ACTIVITY_TYPE_LABELS[activity.activity_type] ?? activity.activity_type}
            </h1>
            <p className="truncate text-sm text-text-muted">{activity.campus}</p>
          </div>
        </div>

        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        {efsLink && <EfsLinkCard link={efsLink} />}

        <TerrainCounters
          activityId={id}
          initialCounters={{
            people_reached: activity.people_reached,
            meaningful_conversations: activity.meaningful_conversations,
            interested_people: activity.interested_people,
            orientations_in_person: activity.orientations_in_person,
            orientations_remote: activity.orientations_remote,
          }}
          barriers={(barriers ?? []).map((barrier) => ({ id: barrier.id, label: barrier.label }))}
          initialBarrierCounts={initialBarrierCounts}
        />

        {activity.status === "en_cours" && (
          <form action={endActivityAction.bind(null, id)}>
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-5 py-3 font-bold text-white"
            >
              Terminer l&apos;action
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
