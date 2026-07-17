"use client";

/**
 * Sélection multiple par puces, jamais de boutons radio (PRD §4.4). Chaque
 * valeur cochée devient un input caché distinct sous le même `name`, pour
 * ressortir en tableau via `formData.getAll(name)` côté Server Action.
 */
export function ChipMultiSelect({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
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
      {value.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
