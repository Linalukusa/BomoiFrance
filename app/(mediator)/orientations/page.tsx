import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { ORIENTATION_CHANNEL_OPTIONS, ORIENTATION_STATUS_OPTIONS } from "@/lib/config/options";
import { EfsLinkCard } from "./EfsLinkCard";

const CHANNEL_LABELS = Object.fromEntries(ORIENTATION_CHANNEL_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_LABELS = Object.fromEntries(ORIENTATION_STATUS_OPTIONS.map((o) => [o.value, o.label]));

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function OrientationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: orientations }, { data: slug }] = await Promise.all([
    supabase
      .from("orientations")
      .select("id, orientation_date, channel, status, activity_id")
      .eq("mediator_id", user.id)
      .is("archived_at", null)
      .order("orientation_date", { ascending: false }),
    supabase.rpc("get_or_create_efs_link"),
  ]);

  const siteUrl = await getSiteUrl();
  const efsLink = typeof slug === "string" && slug.length > 0 ? `${siteUrl}/r/${slug}` : null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <h1 className="text-xl font-bold text-text-strong">Mes orientations</h1>

      {efsLink && <EfsLinkCard link={efsLink} />}

      {!orientations || orientations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-text-muted">
            Aucune orientation enregistrée pour l&apos;instant — ajoutez-en depuis le formulaire « Nouvelle
            activité ».
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orientations.map((orientation) => (
            <li key={orientation.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold text-text-strong">
                  {CHANNEL_LABELS[orientation.channel] ?? orientation.channel}
                </span>
                <span className="shrink-0 text-xs text-text-muted">
                  {formatDate(orientation.orientation_date)}
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                {STATUS_LABELS[orientation.status] ?? orientation.status}
              </p>
              {orientation.activity_id && (
                <Link
                  href={`/activites/${orientation.activity_id}`}
                  className="mt-2 inline-block text-xs font-medium text-bomoi-red"
                >
                  Voir l&apos;activité liée
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
