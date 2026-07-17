"use client";

/**
 * Archivage (soft delete) côté médiateur — jamais de suppression définitive
 * (PRD §4.6). Confirmation simple pour éviter un archivage accidentel : ce
 * n'est pas le blocage "orientation/frein manquant" que le PRD interdit
 * explicitement, juste une protection contre un clic malencontreux.
 */
export function ArchiveButton({ action }: { action: () => void | Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm("Archiver cette activité ? Elle sera exclue des statistiques.")) {
          event.preventDefault();
        }
      }}
      className="flex-1"
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
