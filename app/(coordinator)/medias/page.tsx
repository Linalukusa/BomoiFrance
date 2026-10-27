import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { addMediaLogEntry, archiveMediaLogEntry } from "./actions";

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Coordinateur/admin uniquement (PRD V2, Étape 14). Jamais le fichier média
 * lui-même — juste sa trace (lien externe) et le consentement obtenu, pour
 * les besoins de communication/documentaire de BOMOI.
 */
export default async function MediasPage({
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

  const [{ data: entries }, { data: recentActivities }] = await Promise.all([
    supabase
      .from("media_log")
      .select("id, media_date, media_type, description, consent_obtained, external_link")
      .is("archived_at", null)
      .order("media_date", { ascending: false }),
    supabase
      .from("activities")
      .select("id, activity_date, campus, activity_type")
      .is("archived_at", null)
      .order("activity_date", { ascending: false })
      .limit(30),
  ]);

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
          <h1 className="text-xl font-bold text-text-strong">Médiathèque</h1>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <form action={addMediaLogEntry} className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-bold text-text-strong">Ajouter une entrée</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="media_date" className="mb-1 block text-sm font-medium text-text-strong">
                Date
              </label>
              <input
                id="media_date"
                name="media_date"
                type="date"
                required
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
              />
            </div>
            <div>
              <label htmlFor="media_type" className="mb-1 block text-sm font-medium text-text-strong">
                Type
              </label>
              <select
                id="media_type"
                name="media_type"
                required
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
              >
                <option value="photo">Photo</option>
                <option value="video">Vidéo</option>
              </select>
            </div>
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
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-text-strong">
              Description (facultatif)
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              maxLength={300}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
            <p className="mt-1 text-xs text-text-muted">Jamais de nom, de contact ni de détail de santé.</p>
          </div>

          <div>
            <label htmlFor="external_link" className="mb-1 block text-sm font-medium text-text-strong">
              Lien externe (facultatif)
            </label>
            <input
              id="external_link"
              name="external_link"
              type="url"
              placeholder="https://…"
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-strong">
            <input type="checkbox" name="consent_obtained" className="h-4 w-4" />
            Consentement obtenu pour l&apos;usage de ce média
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
          >
            Ajouter
          </button>
        </form>

        <div className="space-y-3">
          {(entries ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-text-muted">
              Aucune entrée enregistrée pour l&apos;instant.
            </p>
          )}
          {(entries ?? []).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-text-strong">
                    {formatDate(entry.media_date)} · {entry.media_type === "photo" ? "Photo" : "Vidéo"}
                  </p>
                  {entry.description && <p className="mt-1 text-text-secondary">{entry.description}</p>}
                  {entry.external_link && (
                    <a
                      href={entry.external_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-bomoi-red underline underline-offset-2"
                    >
                      {entry.external_link}
                    </a>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    entry.consent_obtained ? "bg-card-alt text-text-strong" : "bg-bomoi-red/10 text-bomoi-red"
                  }`}
                >
                  {entry.consent_obtained ? "Consentement obtenu" : "Sans consentement"}
                </span>
              </div>
              <form action={archiveMediaLogEntry.bind(null, entry.id)} className="mt-3">
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
