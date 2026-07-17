/**
 * Courbe de progression mensuelle simplifiée en barres (PRD §4.7/§4.8) — pas
 * de librairie de graphiques externe, juste des divs proportionnels.
 */
export function MonthlyBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((point) => point.value));

  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((point) => (
        <div key={point.label} className="flex h-full flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-8 rounded-t-md bg-bomoi-red"
              style={{ height: point.value > 0 ? `${Math.max(4, (point.value / max) * 100)}%` : 0 }}
              title={`${point.label} : ${point.value}`}
            />
          </div>
          <span className="text-[10px] text-text-muted">{point.label}</span>
        </div>
      ))}
    </div>
  );
}
