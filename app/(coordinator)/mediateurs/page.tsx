import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SuccessBanner } from "@/components/forms/SuccessBanner";
import { StatusBadge } from "./StatusBadge";

type MediatorRow = {
  id: string;
  first_name: string;
  last_name: string;
  university: string;
  status: string;
  profiles: { role: string } | null;
};

export default async function MediateursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string }>;
}) {
  const { q, deleted } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("mediators")
    .select("id, first_name, last_name, university, status, profiles(role)")
    .is("archived_at", null)
    .order("last_name", { ascending: true });

  if (q) {
    const escaped = q.replace(/[%,]/g, "");
    query = query.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,university.ilike.%${escaped}%`,
    );
  }

  const { data: mediators } = await query;
  const rows = (mediators ?? []) as unknown as MediatorRow[];

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-strong">Médiateurs</h1>
          <Link
            href="/mediateurs/nouveau"
            className="rounded-full bg-bomoi-red px-4 py-2 text-sm font-bold text-white"
          >
            + Inviter un médiateur
          </Link>
        </div>

        {deleted === "1" && <SuccessBanner message="Compte supprimé définitivement." />}

        <form method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Rechercher un nom, une université…"
            className="w-full max-w-sm rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-strong"
          >
            Rechercher
          </button>
        </form>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-text-muted">
              {q ? "Aucun médiateur ne correspond à cette recherche." : "Aucun médiateur pour l'instant."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase text-text-muted">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Université</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((mediator) => (
                  <tr key={mediator.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/mediateurs/${mediator.id}`}
                        className="font-bold text-text-strong hover:text-bomoi-red"
                      >
                        {mediator.first_name} {mediator.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{mediator.university}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={mediator.status} />
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {mediator.profiles?.role === "admin"
                        ? "Admin"
                        : mediator.profiles?.role === "coordinator"
                          ? "Coordinateur"
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
