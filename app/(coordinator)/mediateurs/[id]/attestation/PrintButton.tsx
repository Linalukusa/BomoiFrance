"use client";

/**
 * Impression navigateur standard (pas de génération PDF serveur — hors
 * périmètre) : le CSS @media print de la page masque ce bouton et le reste
 * du chrome de navigation à l'impression.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="w-full rounded-full border border-border bg-card px-5 py-3 text-center text-sm font-bold text-text-strong print:hidden"
    >
      Imprimer
    </button>
  );
}
