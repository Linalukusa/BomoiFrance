import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { setSessionAttendance } from "../actions";

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function SessionDetailPage({
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "coordinator" && profile?.role !== "admin") {
    redirect("/dashboard?error=non_autorise");
  }

  const [{ data: session }, { data: mediators }, { data: attendance }] = await Promise.all([
    supabase.from("sessions").select("id, session_date, label, duration_minutes").eq("id", id).single(),
    supabase.from("mediators").select("id, first_name, last_name").is("archived_at", null).order("first_name"),
    supabase.from("session_attendance").select("mediator_id").eq("session_id", id),
  ]);

  if (!session) {
    notFound();
  }

  const presentIds = new Set((attendance ?? []).map((row) => row.mediator_id));

  return (
    <div className="flex flex-1 flex-col px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/sessions"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text-strong">{session.label}</h1>
            <p className="text-sm text-text-muted">
              {formatDate(session.session_date)} · {session.duration_minutes} min
            </p>
          </div>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <form action={setSessionAttendance.bind(null, id)} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-bold text-text-strong">Présents</h2>
            <div className="space-y-2">
              {(mediators ?? []).map((mediator) => (
                <label key={mediator.id} className="flex items-center gap-2 text-sm text-text-strong">
                  <input
                    type="checkbox"
                    name="mediator_ids"
                    value={mediator.id}
                    defaultChecked={presentIds.has(mediator.id)}
                    className="h-4 w-4"
                  />
                  {mediator.first_name} {mediator.last_name}
                </label>
              ))}
              {(mediators ?? []).length === 0 && (
                <p className="text-sm text-text-muted">Aucun médiateur enregistré.</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
          >
            Enregistrer la présence
          </button>
        </form>
      </div>
    </div>
  );
}
