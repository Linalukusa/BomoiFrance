import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { giveResearchConsent, withdrawResearchConsent } from "./actions";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Remplace "Mes statistiques" comme 3e onglet de la navigation basse
 * (BottomNav.tsx) — les chiffres d'impact personnels restent disponibles
 * via le lien vers /statistiques ci-dessous, pas dans les deux écrans à la
 * fois.
 */
export default async function ParcoursPage({
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

  const [{ data: mediator }, { data: hours }] = await Promise.all([
    supabase
      .from("mediators")
      .select("joined_at, research_consent_at, research_withdrawn_at, certificate_status, certificate_issued_at")
      .eq("id", user.id)
      .single(),
    supabase.from("v_mediator_hours").select("field_hours, session_hours, total_hours").eq("mediator_id", user.id).maybeSingle(),
  ]);

  const consentActive = Boolean(mediator?.research_consent_at) && !mediator?.research_withdrawn_at;
  const fieldHours = Math.round((hours?.field_hours ?? 0) * 10) / 10;
  const sessionHours = Math.round((hours?.session_hours ?? 0) * 10) / 10;
  const totalHours = Math.round((hours?.total_hours ?? 0) * 10) / 10;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <h1 className="text-xl font-bold text-text-strong">Mon parcours</h1>

      {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
      {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

      <div className="rounded-xl bg-ink p-4 text-white">
        <p className="text-sm text-white/70">Heures de mission</p>
        <p className="text-3xl font-bold">{totalHours} h</p>
        <p className="text-xs text-white/70">
          dont {fieldHours} h de terrain et {sessionHours} h de formation
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="mb-3 font-bold text-text-strong">Engagement</h2>
        <div className="flex justify-between gap-4 border-b border-border-subtle pb-3">
          <dt className="text-text-muted">Engagé·e depuis le</dt>
          <dd className="font-medium text-text-strong">{formatDate(mediator?.joined_at ?? null)}</dd>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="mb-1 font-bold text-text-strong">Attestation d&apos;heures</h2>
        <p className="mb-3 text-xs text-text-muted">
          Signée par BOMOI et l&apos;EFS — à demander à votre coordinateur, qui est seul à pouvoir la
          générer et l&apos;imprimer.
        </p>
        <p className="font-medium text-text-strong">
          {mediator?.certificate_status === "genere"
            ? `Générée le ${formatDate(mediator.certificate_issued_at)}`
            : "Pas encore générée"}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="mb-1 font-bold text-text-strong">Participation à la recherche</h2>
        <p className="mb-3 text-xs leading-relaxed text-text-secondary">
          BOMOI collabore avec iCOMMS (Université du Cap) pour étudier comment cet outil numérique est
          utilisé par les médiateurs — jamais pour évaluer vos actions de médiation elles-mêmes. Ce
          consentement est distinct de celui donné à l&apos;onboarding, facultatif, et modifiable à tout
          moment depuis cet écran.
        </p>
        <p className="mb-3 font-medium text-text-strong">
          {mediator?.research_consent_at
            ? consentActive
              ? `Donné le ${formatDate(mediator.research_consent_at)}`
              : `Retiré le ${formatDate(mediator.research_withdrawn_at)}`
            : "Non donné"}
        </p>
        <form action={consentActive ? withdrawResearchConsent : giveResearchConsent}>
          <SubmitButton
            label={consentActive ? "Retirer mon consentement" : "Donner mon consentement"}
            pendingLabel="Enregistrement…"
          />
        </form>
      </div>

      <Link
        href="/statistiques"
        className="block rounded-full border border-dashed border-border bg-card-alt px-4 py-3 text-center text-sm font-bold text-bomoi-red"
      >
        Voir mes statistiques d&apos;impact
      </Link>

      <Link
        href="/changements"
        className="block rounded-full border border-dashed border-border bg-card-alt px-4 py-3 text-center text-sm font-bold text-bomoi-red"
      >
        Voir les nouveautés de l&apos;outil
      </Link>
    </div>
  );
}
