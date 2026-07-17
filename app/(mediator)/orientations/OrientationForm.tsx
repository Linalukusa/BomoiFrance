"use client";

import { useState, type FormEvent } from "react";
import { RadioList } from "./RadioList";
import { ChipSelect } from "../activites/ChipSelect";
import { ORIENTATION_CHANNEL_OPTIONS, ORIENTATION_STATUS_OPTIONS } from "@/lib/config/options";
import { orientationSchema } from "@/lib/validation/orientation";
import { todayISODate } from "@/lib/validation/activity";

export function OrientationForm({
  action,
  activityId,
  collections,
  submitLabel = "Enregistrer l'orientation",
}: {
  action: (formData: FormData) => void | Promise<void>;
  activityId?: string;
  collections: readonly { id: string; label: string }[];
  submitLabel?: string;
}) {
  const [collectionId, setCollectionId] = useState("");
  const [orientationDate, setOrientationDate] = useState(todayISODate());
  const [channel, setChannel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = orientationSchema.safeParse({
      collection_id: collectionId,
      orientation_date: orientationDate,
      channel: channel ?? "",
      status: status ?? "",
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
      {activityId && <input type="hidden" name="activity_id" value={activityId} />}

      <div className="flex items-start gap-2 rounded-xl bg-card-alt p-3 text-sm text-text-secondary">
        <span aria-hidden>ⓘ</span>
        <span>Aucune information permettant d&apos;identifier la personne n&apos;est demandée ici.</span>
      </div>

      <div>
        <label htmlFor="collection_id" className="mb-1 block text-sm font-medium text-text-strong">
          Collecte concernée
        </label>
        <select
          id="collection_id"
          name="collection_id"
          value={collectionId}
          onChange={(event) => setCollectionId(event.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        >
          <option value="">Aucune collecte précise (maison du don, plateforme EFS…)</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="orientation_date" className="mb-1 block text-sm font-medium text-text-strong">
          Date
        </label>
        <input
          id="orientation_date"
          name="orientation_date"
          type="date"
          required
          max={todayISODate()}
          value={orientationDate}
          onChange={(event) => setOrientationDate(event.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Canal</p>
        <ChipSelect name="channel" options={ORIENTATION_CHANNEL_OPTIONS} value={channel} onChange={setChannel} />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Statut de suivi</p>
        <RadioList name="status" options={ORIENTATION_STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>

      {error && <p className="text-sm text-bomoi-red">{error}</p>}

      <button
        type="submit"
        disabled={!channel || !status}
        className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}
