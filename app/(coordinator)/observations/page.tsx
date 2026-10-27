import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { addFieldObservation, archiveFieldObservation } from "./actions";

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Coordinateur/admin uniquement — jamais visible par le médiateur concerné
 * (PRD V2, Étape 14). Matière qualitative pour le guide de médiation BOMOI
 * et la recherche iCOMMS, jamais un outil de notation individuelle.
 */
export default async function ObservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "coordinator" && profile?.role !== "admin") {
    redirect("/dashboard?error=non_autorise");
  }

  const [{ data: observations }, { data: mediators }, { data: recentActivities }] = await Promise.all([
    supabase
      .from("field_observations")
      .select("id, observation_date, campus, content, mediators(first_name, last_name), activities(activity_date, campus)")
      .is("archived_at", null)
      .order("observation_date", { ascending: false }),
    supabase.from("mediators").select("id, first_name, last_name").is("archived_at", null).order("first_name"),
    supabase
      .from("activities")
      .select("id, activity_date, campus, activity_type")
      .is("archived_at", null)
      .order("activity_date", { ascending: false })
      .limit(30),
  ]);

  type ObservationRow = {
    id: string;
    observation_date: string;
    campus: string | null;
    content: string;
    mediators: { first_name: string; last_name: string } | null;
    activities: { activity_date: string; campus: string } | null;
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold text-text-strong">Observations de terrain</h1>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <form
          action={addFieldObservation}
          className="space-y-4 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="font-bold text-text-strong">Ajouter une observation</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="observation_date" className="mb-1 block text-sm font-medium text-text-strong">
                Date
              </label>
              <input
                id="observation_date"
                name="observation_date"
                type="date"
                required
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
              />
            </div>
            <div>
              <label htmlFor="campus" className="mb-1 block text-sm font-medium text-text-strong">
                Campus (facultatif)
              </label>
              <input
                id="campus"
                name="campus"
                type="text"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
              />
            </div>
          </div>

          <div>
            <label htmlFor="mediator_id" className="mb-1 block text-sm font-medium text-text-strong">
              Médiateur concerné (facultatif)
            </label>
            <select
              id="mediator_id"
              name="mediator_id"
              defaultValue=""
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            >
              <option value="">Aucun en particulier</option>
              {(mediators ?? []).map((mediator) => (
                <option key={mediator.id} value={mediator.id}>
                  {mediator.first_name} {mediator.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="activity_id" className="mb-1 block text-sm font-medium text-text-strong">
              Action liée (facultatif)
            </label>
            <select
              id="activity_id"
              name="activity_id"
              defaultValue=""
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            >
              <option value="">Aucune</option>
              {(recentActivities ?? []).map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {formatDate(activity.activity_date)} · {activity.campus} · {activity.activity_type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="content" className="mb-1 block text-sm font-medium text-text-strong">
              Observation
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={4}
              maxLength={1000}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
            <p className="mt-1 text-xs text-text-muted">Jamais de nom, de contact ni de détail de santé.</p>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
          >
            Ajouter
          </button>
        </form>

        <div className="space-y-3">
          {(observations ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-text-muted">
              Aucune observation enregistrée pour l&apos;instant.
            </p>
          )}
          {((observations ?? []) as unknown as ObservationRow[]).map((observation) => (
            <div key={observation.id} className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-medium text-text-strong">
                {formatDate(observation.observation_date)}
                {observation.campus ? ` · ${observation.campus}` : ""}
                {observation.mediators
                  ? ` · ${observation.mediators.first_name} ${observation.mediators.last_name}`
                  : ""}
              </p>
              <p className="mt-1 text-text-secondary">{observation.content}</p>
              <form action={archiveFieldObservation.bind(null, observation.id)} className="mt-3">
                <button type="submit" className="text-xs font-bold text-text-muted underline underline-offset-2">
                  Archiver
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
