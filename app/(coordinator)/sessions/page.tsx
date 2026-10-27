import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { addSession } from "./actions";

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Coordinateur/admin uniquement. Les tables sessions/session_attendance
 * existent depuis l'Étape 13 (v_mediator_hours en dépendait déjà) ; cet
 * écran est leur seule interface de gestion.
 */
export default async function SessionsPage({
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

  const [{ data: sessions }, { data: attendanceRows }] = await Promise.all([
    supabase.from("sessions").select("id, session_date, label, duration_minutes").order("session_date", { ascending: false }),
    supabase.from("session_attendance").select("session_id"),
  ]);

  const attendanceCounts = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    attendanceCounts.set(row.session_id, (attendanceCounts.get(row.session_id) ?? 0) + 1);
  }

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
          <h1 className="text-xl font-bold text-text-strong">Sessions de formation</h1>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <form action={addSession} className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-bold text-text-strong">Nouvelle session</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="session_date" className="mb-1 block text-sm font-medium text-text-strong">
                Date
              </label>
              <input
                id="session_date"
                name="session_date"
                type="date"
                required
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
              />
            </div>
            <div>
              <label htmlFor="duration_minutes" className="mb-1 block text-sm font-medium text-text-strong">
                Durée (minutes)
              </label>
              <input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min={1}
                required
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
              />
            </div>
          </div>

          <div>
            <label htmlFor="label" className="mb-1 block text-sm font-medium text-text-strong">
              Intitulé
            </label>
            <input
              id="label"
              name="label"
              type="text"
              required
              maxLength={200}
              placeholder="Ex. Formation accueil et posture"
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
          >
            Créer
          </button>
        </form>

        <div className="space-y-3">
          {(sessions ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-text-muted">
              Aucune session enregistrée pour l&apos;instant.
            </p>
          )}
          {(sessions ?? []).map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="block rounded-xl border border-border bg-card p-4 text-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-strong">{session.label}</p>
                  <p className="text-text-muted">
                    {formatDate(session.session_date)} · {session.duration_minutes} min
                  </p>
                </div>
                <span className="rounded-full bg-card-alt px-2.5 py-1 text-xs font-bold text-text-strong">
                  {attendanceCounts.get(session.id) ?? 0} présent(s)
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
