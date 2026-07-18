"use client";

import { useState, type FormEvent } from "react";
import { ChipMultiSelect } from "./ChipMultiSelect";
import { barrierEntrySchema } from "@/lib/validation/barrier";
import { SubmitButton } from "@/components/forms/SubmitButton";

export function BarrierForm({
  action,
  barriers,
  activities,
  activityId,
  submitLabel = "Enregistrer",
}: {
  action: (formData: FormData) => void | Promise<void>;
  barriers: readonly { id: string; label: string }[];
  activities?: readonly { id: string; label: string }[];
  activityId?: string;
  submitLabel?: string;
}) {
  const [selectedActivityId, setSelectedActivityId] = useState(activityId ?? "");
  const [barrierIds, setBarrierIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = barrierEntrySchema.safeParse({
      activity_id: selectedActivityId,
      barrier_ids: barrierIds,
      note,
    });

    if (!parsed.success) {
      event.preventDefault();
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
      return;
    }

    setError(null);
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-6 pb-28">
      {activityId ? (
        <input type="hidden" name="activity_id" value={activityId} />
      ) : (
        <div>
          <label htmlFor="activity_id" className="mb-1 block text-sm font-medium text-text-strong">
            Activité concernée
          </label>
          <select
            id="activity_id"
            name="activity_id"
            required
            value={selectedActivityId}
            onChange={(event) => setSelectedActivityId(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          >
            <option value="">Choisir une activité…</option>
            {activities?.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Freins observés</p>
        <ChipMultiSelect
          name="barrier_ids"
          options={barriers.map((b) => ({ value: b.id, label: b.label }))}
          value={barrierIds}
          onChange={setBarrierIds}
        />
      </div>

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-text-strong">
          Note (facultatif)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Observation libre, anonyme, commune aux freins sélectionnés"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        />
      </div>

      {error && <p className="text-sm text-bomoi-red">{error}</p>}

      <SubmitButton label={submitLabel} disabled={barrierIds.length === 0 || !selectedActivityId} />
    </form>
  );
}
