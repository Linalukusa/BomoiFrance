"use client";

/**
 * Champ numérique en stepper +/− plutôt que clavier natif (PRD §4.2).
 * `min`/`max` bornent directement les boutons : un état invalide (valeur
 * négative, conversations > personnes atteintes...) n'est jamais atteignable
 * depuis l'UI, la validation serveur n'est qu'un filet de sécurité.
 */
export function Stepper({
  label,
  name,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <span className="min-w-0 flex-1 text-sm text-text-strong">{label}</span>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Diminuer ${label}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-alt text-lg font-bold text-text-strong disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 shrink-0 text-center text-base font-bold text-text-strong">{value}</span>
        <button
          type="button"
          onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
          disabled={max !== undefined && value >= max}
          aria-label={`Augmenter ${label}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bomoi-red text-lg font-bold text-white disabled:opacity-40"
        >
          +
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
