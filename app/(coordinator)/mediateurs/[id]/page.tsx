import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { MediatorForm } from "./MediatorForm";
import { RoleSelector } from "./RoleSelector";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { updateMediator, changeRole, deleteMediatorAccount } from "./actions";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toDateInputValue(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

type MediatorDetail = {
  id: string;
  first_name: string;
  last_name: string;
  university: string;
  languages: string[];
  status: string;
  availability: string | null;
  charter_accepted_at: string | null;
  privacy_accepted_at: string | null;
  created_at: string;
  joined_at: string | null;
  left_at: string | null;
  leave_reason: string | null;
  research_consent_at: string | null;
  research_withdrawn_at: string | null;
  certificate_status: string;
  certificate_issued_at: string | null;
  profiles: { role: string } | null;
};

export default async function MediateurDetailPage({
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

  const isAdmin = profile.role === "admin";

  const { data: mediatorRow } = await supabase
    .from("mediators")
    .select(
      "id, first_name, last_name, university, languages, status, availability, charter_accepted_at, privacy_accepted_at, created_at, joined_at, left_at, leave_reason, research_consent_at, research_withdrawn_at, certificate_status, certificate_issued_at, profiles(role)",
    )
    .eq("id", id)
    .single();

  if (!mediatorRow) {
    notFound();
  }

  const mediator = mediatorRow as unknown as MediatorDetail;
  const mediatorRole = mediator.profiles?.role ?? "mediator";
  const isSelf = id === user.id;

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/mediateurs"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-strong"
          >
            ‹
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-text-strong">
            {mediator.first_name} {mediator.last_name}
          </h1>
        </div>

        {saved === "1" && <SuccessBanner message="Enregistré avec succès." />}
        {error && <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>}

        <dl className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
          <Row label="Charte acceptée" value={formatDate(mediator.charter_accepted_at)} />
          <Row label="RGPD accepté" value={formatDate(mediator.privacy_accepted_at)} />
          <Row label="Compte créé le" value={formatDate(mediator.created_at)} />
        </dl>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-bold text-text-strong">Informations</h2>
          <MediatorForm
            action={updateMediator.bind(null, id)}
            initialValues={{
              first_name: mediator.first_name,
              last_name: mediator.last_name,
              university: mediator.university,
              status: mediator.status,
              availability: mediator.availability ?? "",
              languages: (mediator.languages ?? []).join(", "),
              joined_at: toDateInputValue(mediator.joined_at),
              left_at: toDateInputValue(mediator.left_at),
              leave_reason: mediator.leave_reason ?? "",
            }}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-1 font-bold text-text-strong">Recherche et attestation</h2>
          <p className="mb-3 text-xs text-text-muted">
            Le consentement recherche ne se donne et ne se retire que depuis le compte du médiateur
            lui-même (écran « Mon parcours ») — lecture seule ici.
          </p>
          <dl className="space-y-3 text-sm">
            <Row
              label="Consentement recherche"
              value={
                mediator.research_consent_at && !mediator.research_withdrawn_at
                  ? `Donné le ${formatDate(mediator.research_consent_at)}`
                  : mediator.research_withdrawn_at
                    ? `Retiré le ${formatDate(mediator.research_withdrawn_at)}`
                    : "Non donné"
              }
            />
            <Row
              label="Attestation d'heures"
              value={
                mediator.certificate_status === "genere"
                  ? `Générée le ${formatDate(mediator.certificate_issued_at)}`
                  : "Pas encore générée"
              }
            />
          </dl>
          <Link
            href={`/mediateurs/${id}/attestation`}
            className="mt-3 block rounded-full border border-dashed border-border bg-card-alt px-4 py-2 text-center text-sm font-bold text-bomoi-red"
          >
            Voir l&apos;attestation
          </Link>
        </div>

        {isAdmin && (
          <>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-1 font-bold text-text-strong">Rôle du compte</h2>
              <p className="mb-3 text-xs text-text-muted">
                Rôle principal du compte (accès coordinateur/admin) — indépendant de la fiche médiateur
                ci-dessus (PRD §2.1).
              </p>
              {isSelf ? (
                <p className="text-sm text-text-muted">
                  Vous ne pouvez pas modifier votre propre rôle depuis cet écran.
                </p>
              ) : (
                <RoleSelector action={changeRole.bind(null, id)} currentRole={mediatorRole} />
              )}
            </div>

            <div className="rounded-xl border border-dashed border-bomoi-red p-4">
              <h2 className="mb-3 font-bold text-text-strong">Zone dangereuse</h2>
              {isSelf ? (
                <p className="text-sm text-text-muted">
                  Vous ne pouvez pas supprimer votre propre compte depuis cet écran.
                </p>
              ) : (
                <DeleteAccountButton action={deleteMediatorAccount.bind(null, id)} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium text-text-strong">{value}</dd>
    </div>
  );
}
