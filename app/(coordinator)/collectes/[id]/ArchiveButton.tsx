"use client";

/**
 * Même pattern que app/(mediator)/activites/[id]/ArchiveButton.tsx :
 * confirmation simple contre un clic malencontreux, pas le genre de
 * blocage interdit par le PRD (ça ne bloque aucune saisie, juste l'archivage).
 */
export function ArchiveButton({ action }: { action: () => void | Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm("Archiver cette collecte ? Elle sera exclue des statistiques.")) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="w-full rounded-full border border-bomoi-red bg-card px-5 py-3 text-sm font-bold text-bomoi-red"
      >
        Archiver
      </button>
    </form>
  );
}
