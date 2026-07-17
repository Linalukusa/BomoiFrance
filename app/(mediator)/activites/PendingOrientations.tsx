"use client";

import { useState } from "react";
import { ChipSelect } from "./ChipSelect";
import { RadioList } from "../orientations/RadioList";
import { ORIENTATION_CHANNEL_OPTIONS, ORIENTATION_STATUS_OPTIONS } from "@/lib/config/options";
import { orientationSchema } from "@/lib/validation/orientation";
import { todayISODate } from "@/lib/validation/activity";
import type { z } from "zod";

export type PendingOrientation = z.infer<typeof orientationSchema>;

const CHANNEL_LABELS = Object.fromEntries(ORIENTATION_CHANNEL_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_LABELS = Object.fromEntries(ORIENTATION_STATUS_OPTIONS.map((o) => [o.value, o.label]));

/**
 * Ajout d'orientations dans le même flux que « Nouvelle activité », avant
 * l'enregistrement final (PRD §4.2). Les brouillons restent en mémoire côté
 * client puis sont envoyés avec l'activité en un seul appel RPC
 * (create_activity_with_orientations), pour éviter toute activité orpheline
 * si l'un des deux échouait séparément.
 */
export function PendingOrientations({
  collections,
  value,
  onChange,
}: {
  collections: readonly { id: string; label: string }[];
  value: PendingOrientation[];
  onChange: (next: PendingOrientation[]) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [collectionId, setCollectionId] = useState("");
  const [orientationDate, setOrientationDate] = useState(todayISODate());
  const [channel, setChannel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetDraft() {
    setCollectionId("");
    setOrientationDate(todayISODate());
    setChannel(null);
    setStatus(null);
    setError(null);
  }

  function handleAdd() {
    const parsed = orientationSchema.safeParse({
      collection_id: collectionId,
      orientation_date: orientationDate,
      channel: channel ?? "",
      status: status ?? "",
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
      return;
    }

    onChange([...value, parsed.data]);
    resetDraft();
    setIsAdding(false);
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text-strong">Orientations ({value.length})</p>

      {value.length > 0 && (
        <ul className="mb-3 space-y-2">
          {value.map((orientation, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
            >
              <span className="text-text-strong">
                {CHANNEL_LABELS[orientation.channel] ?? orientation.channel} —{" "}
                {STATUS_LABELS[orientation.status] ?? orientation.status}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label="Retirer cette orientation"
                className="shrink-0 text-text-muted"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <div className="space-y-4 rounded-xl border border-border bg-card-alt p-4">
          <div>
            <label htmlFor="pending_collection_id" className="mb-1 block text-sm font-medium text-text-strong">
              Collecte concernée
            </label>
            <select
              id="pending_collection_id"
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
            <label
              htmlFor="pending_orientation_date"
              className="mb-1 block text-sm font-medium text-text-strong"
            >
              Date
            </label>
            <input
              id="pending_orientation_date"
              type="date"
              max={todayISODate()}
              value={orientationDate}
              onChange={(event) => setOrientationDate(event.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-text-strong">Canal</p>
            <ChipSelect
              name="pending_channel"
              options={ORIENTATION_CHANNEL_OPTIONS}
              value={channel}
              onChange={setChannel}
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-text-strong">Statut de suivi</p>
            <RadioList name="pending_status" options={ORIENTATION_STATUS_OPTIONS} value={status} onChange={setStatus} />
          </div>

          {error && <p className="text-sm text-bomoi-red">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                resetDraft();
              }}
              className="flex-1 rounded-full border border-border bg-card px-5 py-2 text-sm font-bold text-text-strong"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!channel || !status}
              className="flex-1 rounded-full bg-bomoi-red px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm font-bold text-bomoi-red"
        >
          + Ajouter une orientation
        </button>
      )}
    </div>
  );
}
