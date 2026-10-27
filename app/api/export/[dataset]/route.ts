import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DATASETS = ["usage"] as const;
type Dataset = (typeof DATASETS)[number];

type UsageMetricsRow = {
  mediator_id: string;
  activities_started: number;
  activities_participated: number;
  activities_closed: number;
  avg_closure_hours: number | null;
  shared_activities_count: number;
  misconceptions_logged: number;
  sessions_attended: number;
};

type MediatorHoursRow = {
  mediator_id: string;
  field_hours: number;
  session_hours: number;
  total_hours: number;
};

const COLUMNS = [
  "research_code",
  "university",
  "activities_started",
  "activities_participated",
  "activities_closed",
  "avg_closure_hours",
  "shared_activities_count",
  "misconceptions_logged",
  "sessions_attended",
  "field_hours",
  "session_hours",
  "total_hours",
] as const;

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Admin uniquement — jamais coordinateur, même si coordinateur a un accès
 * en lecture large par ailleurs. Jamais mediator_id ni nom dans la sortie :
 * research_code à la place (0010_mediator_journey.sql), et seulement pour
 * les médiateurs ayant un consentement recherche actif (donné, pas
 * retiré) — RÈGLE ABSOLUE du prompt V2, revérifiée ici, pas seulement
 * déduite de app_settings.research_collection_enabled.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;

  if (!DATASETS.includes(dataset as Dataset)) {
    return NextResponse.json({ error: "Jeu de données inconnu." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  }

  const [{ data: mediators, error: mediatorsError }, { data: usage, error: usageError }, { data: hours, error: hoursError }] =
    await Promise.all([
      supabase
        .from("mediators")
        .select("id, research_code, university, research_consent_at, research_withdrawn_at"),
      supabase.from("v_usage_metrics").select("*"),
      supabase.from("v_mediator_hours").select("*"),
    ]);

  if (mediatorsError || usageError || hoursError) {
    return NextResponse.json(
      { error: (mediatorsError ?? usageError ?? hoursError)?.message ?? "Export impossible." },
      { status: 500 },
    );
  }

  const consenting = new Map(
    (mediators ?? [])
      .filter((m) => m.research_consent_at && !m.research_withdrawn_at)
      .map((m) => [m.id, { research_code: m.research_code, university: m.university }]),
  );

  const hoursByMediator = new Map((hours as MediatorHoursRow[] | null ?? []).map((h) => [h.mediator_id, h]));

  const rows = (usage as UsageMetricsRow[] | null ?? [])
    .filter((row) => consenting.has(row.mediator_id))
    .map((row) => {
      const meta = consenting.get(row.mediator_id)!;
      const mediatorHours = hoursByMediator.get(row.mediator_id);
      return {
        research_code: meta.research_code,
        university: meta.university,
        activities_started: row.activities_started,
        activities_participated: row.activities_participated,
        activities_closed: row.activities_closed,
        avg_closure_hours: row.avg_closure_hours,
        shared_activities_count: row.shared_activities_count,
        misconceptions_logged: row.misconceptions_logged,
        sessions_attended: row.sessions_attended,
        field_hours: mediatorHours?.field_hours ?? 0,
        session_hours: mediatorHours?.session_hours ?? 0,
        total_hours: mediatorHours?.total_hours ?? 0,
      };
    });

  const lines = [COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(COLUMNS.map((column) => csvEscape(row[column])).join(","));
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bomoi_${dataset}_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
