import { MEDIATOR_STATUS_OPTIONS } from "@/lib/config/options";

const STATUS_LABELS = Object.fromEntries(MEDIATOR_STATUS_OPTIONS.map((o) => [o.value, o.label]));

// PRD §3 : "badges de statut (pilule sombre = actif, pilule claire = formé,
// pilule estompée = inactif)". candidat/sélectionné (étapes amont du
// parcours, pas dans les maquettes) reprennent le style estompé en pointillé
// pour rester visuellement distincts sans introduire une 4e famille de badge.
const STATUS_STYLES: Record<string, string> = {
  actif: "bg-ink text-white",
  forme: "bg-card-alt text-text-strong border border-border",
  inactif: "bg-card text-text-muted border border-border-subtle",
  candidat: "bg-card text-text-muted border border-dashed border-border",
  selectionne: "bg-card text-text-muted border border-dashed border-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
        STATUS_STYLES[status] ?? "bg-card-alt text-text-strong"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
