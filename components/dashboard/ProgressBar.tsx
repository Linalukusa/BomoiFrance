/**
 * Barre de progression (freins les plus fréquents, PRD §3/§4.8) : barre rouge
 * fine sur piste grise + pourcentage aligné à droite, infobulle native pour
 * la méthode de calcul.
 */
export function ProgressBar({
  label,
  percentage,
  tooltip,
}: {
  label: string;
  percentage: number;
  tooltip?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percentage));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-1 truncate text-text-strong">
          {label}
          {tooltip && (
            <span aria-hidden title={tooltip} className="cursor-help text-xs text-text-muted">
              ⓘ
            </span>
          )}
        </span>
        <span className="shrink-0 text-text-muted">{Math.round(clamped)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-alt">
        <div className="h-full rounded-full bg-bomoi-red" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
