"use client";

import { useState } from "react";
import { ChipSelect } from "../ChipSelect";
import { ChipMultiSelect } from "@/components/forms/ChipMultiSelect";
import { CAMPUS_OPTIONS, ACTIVITY_TYPE_OPTIONS } from "@/lib/config/options";
import { SubmitButton } from "@/components/forms/SubmitButton";

/**
 * Objectif : démarrer en moins de 5 secondes (PRD V2, Étape 11). Pas de
 * chiffres ici — ils se saisissent sur l'écran terrain, tap par tap, une
 * fois l'action démarrée.
 */
export function StartActivityForm({
  action,
  defaultCampus,
  collections,
  peerMediators,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultCampus: string;
  collections: readonly { id: string; label: string }[];
  peerMediators: readonly { value: string; label: string }[];
}) {
  const [campus, setCampus] = useState(defaultCampus);
  const [activityType, setActivityType] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  return (
    <form action={action} className="space-y-6 pb-28">
      <div>
        <label htmlFor="campus" className="mb-1 block text-sm font-medium text-text-strong">
          Lieu / université
        </label>
        <select
          id="campus"
          name="campus"
          required
          value={campus}
          onChange={(event) => setCampus(event.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        >
          {CAMPUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Type d&apos;action</p>
        <ChipSelect
          name="activity_type"
          options={ACTIVITY_TYPE_OPTIONS}
          value={activityType}
          onChange={setActivityType}
        />
      </div>

      {activityType === "presence_collecte" && (
        <div>
          <label htmlFor="collection_id" className="mb-1 block text-sm font-medium text-text-strong">
            Collecte EFS
          </label>
          <select
            id="collection_id"
            name="collection_id"
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          >
            <option value="">Aucune collecte précise</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {peerMediators.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium text-text-strong">Médiateurs présents (facultatif)</p>
          <ChipMultiSelect
            name="participant_ids"
            options={peerMediators}
            value={participantIds}
            onChange={setParticipantIds}
          />
        </div>
      )}

      <SubmitButton label="Démarrer" pendingLabel="Démarrage…" disabled={!activityType} />
    </form>
  );
}
