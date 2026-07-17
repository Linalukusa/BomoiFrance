"use client";

/**
 * Sélection unique par puces (chips), jamais de boutons radio (PRD §4.2/§4.4).
 * Cliquer une puce déjà sélectionnée la désélectionne — utile pour les
 * champs optionnels (durée, support utilisé).
 */
export function ChipSelect({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(selected ? null : option.value)}
            aria-pressed={selected}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              selected
                ? "border-bomoi-red bg-bomoi-red text-white"
                : "border-border bg-card text-text-strong"
            }`}
          >
            {option.label}
          </button>
        );
      })}
      <input type="hidden" name={name} value={value ?? ""} />
    </div>
  );
}
