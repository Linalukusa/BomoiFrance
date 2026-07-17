import { InfoTooltip } from "./InfoTooltip";

export function StatCard({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string | number;
  tooltip?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-1">
        <p className="text-xs text-text-muted">{label}</p>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <p className="text-2xl font-bold text-text-strong">{value}</p>
    </div>
  );
}
