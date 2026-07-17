"use client";

/**
 * Liste à sélection unique (statut de suivi) — rendue en lignes avec
 * indicateur rond, pas en chips, pour la distinguer visuellement d'un champ
 * multi-select comme les freins. PRD §4.3.
 */
export function RadioList({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm ${
              selected ? "border-bomoi-red" : "border-border"
            } bg-card`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                selected ? "border-bomoi-red" : "border-border"
              }`}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-bomoi-red" />}
            </span>
            <span className="text-text-strong">{option.label}</span>
          </button>
        );
      })}
      <input type="hidden" name={name} value={value ?? ""} />
    </div>
  );
}
