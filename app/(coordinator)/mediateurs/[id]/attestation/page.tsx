import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { issueCertificate } from "./actions";
import { PrintButton } from "./PrintButton";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Imprimable, coordinateur/admin uniquement — un médiateur ne peut jamais
 * atteindre cette route (sous app/(coordinator)/) ni générer sa propre
 * attestation (trigger guard_mediator_journey_fields, 0010). Les heures
 * viennent de v_mediator_hours (terrain + sessions de formation), jamais
 * présentées comme un objectif chiffré individuel.
 */
export default async function AttestationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "coordinator" && profile?.role !== "admin") {
    redirect("/dashboard?error=non_autorise");
  }

  const [{ data: mediator }, { data: hours }] = await Promise.all([
    supabase
      .from("mediators")
      .select("first_name, last_name, university, joined_at, certificate_status, certificate_issued_at")
      .eq("id", id)
      .single(),
    supabase.from("v_mediator_hours").select("total_hours").eq("mediator_id", id).maybeSingle(),
  ]);

  if (!mediator) {
    notFound();
  }

  const totalHours = Math.round((hours?.total_hours ?? 0) * 10) / 10;
  const isIssued = mediator.certificate_status === "genere";

  return (
    <div className="flex flex-1 flex-col px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3 print:hidden">
          <Link
            href={`/mediateurs/${id}`}
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold text-text-strong">Attestation</h1>
        </div>

        {error && <p className="text-sm text-bomoi-red print:hidden">{decodeURIComponent(error)}</p>}

        <div className="rounded-xl border border-border bg-card p-8 print:border-none print:p-0">
          <p className="text-center text-xs uppercase tracking-widest text-text-muted">
            BOMOI Mediation Hub — en partenariat avec l&apos;EFS Occitanie
          </p>
          <h2 className="mt-4 text-center text-2xl font-bold text-text-strong">
            Attestation de participation
          </h2>

          <p className="mt-6 text-sm leading-relaxed text-text-secondary">
            Nous attestons que
          </p>
          <p className="text-lg font-bold text-text-strong">
            {mediator.first_name} {mediator.last_name}
          </p>
          <p className="text-sm text-text-secondary">{mediator.university}</p>

          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            a participé en qualité de médiateur bénévole au programme de sensibilisation au don de sang
            porté par BOMOI
            {mediator.joined_at ? ` depuis le ${formatDate(mediator.joined_at)}` : ""}, pour un total
            d&apos;environ <strong>{totalHours} heure{totalHours === 1 ? "" : "s"}</strong> de mission
            (actions de terrain et temps de formation confondus).
          </p>

          <div className="mt-10 grid grid-cols-2 gap-8 text-sm text-text-muted">
            <div>
              <p>Pour BOMOI</p>
              <div className="mt-8 border-t border-border" />
            </div>
            <div>
              <p>Pour l&apos;EFS Occitanie</p>
              <div className="mt-8 border-t border-border" />
            </div>
          </div>

          <p className="mt-6 text-right text-xs text-text-muted">
            {isIssued
              ? `Attestation générée le ${formatDate(mediator.certificate_issued_at)}`
              : "Document provisoire — pas encore marqué comme généré"}
          </p>
        </div>

        <div className="space-y-3 print:hidden">
          <PrintButton />
          {!isIssued && (
            <form action={issueCertificate.bind(null, id)}>
              <button
                type="submit"
                className="w-full rounded-full bg-bomoi-red px-5 py-3 text-center text-sm font-bold text-white"
              >
                Marquer comme générée
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
