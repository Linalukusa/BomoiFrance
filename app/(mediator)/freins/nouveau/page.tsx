import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";
import { BarrierForm } from "../BarrierForm";
import { createBarrierEntry } from "./actions";

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

export default async function NouveauFreinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; activity_id?: string }>;
}) {
  const { error, activity_id: activityId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: barriers }, { data: activities }] = await Promise.all([
    supabase.from("barriers").select("id, label").order("sort_order"),
    activityId
      ? Promise.resolve({ data: null })
      : supabase
          .from("activities")
          .select("id, activity_date, campus, activity_type")
          .eq("mediator_id", user.id)
          .is("archived_at", null)
          .order("activity_date", { ascending: false }),
  ]);

  const activityOptions = (activities ?? []).map((activity) => ({
    id: activity.id,
    label: `${formatDate(activity.activity_date)} – ${
      ACTIVITY_TYPE_LABELS[activity.activity_type] ?? activity.activity_type
    } (${activity.campus})`,
  }));

  const backHref = activityId ? `/activites/${activityId}` : "/freins";
  const noActivityAvailable = !activityId && activityOptions.length === 0;

  return (
    <div className="flex flex-1 flex-col px-6 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href={backHref}
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold text-text-strong">Nouveau frein</h1>
        </div>

        {error && <p className="mb-4 text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        {noActivityAvailable ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="mb-4 text-sm text-text-muted">
              Aucune activité enregistrée pour l&apos;instant — créez-en une avant de renseigner un frein.
            </p>
            <Link
              href="/activites/nouveau"
              className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white"
            >
              Créer une activité
            </Link>
          </div>
        ) : (
          <BarrierForm
            action={createBarrierEntry}
            barriers={barriers ?? []}
            activities={activityId ? undefined : activityOptions}
            activityId={activityId}
          />
        )}
      </div>
    </div>
  );
}
