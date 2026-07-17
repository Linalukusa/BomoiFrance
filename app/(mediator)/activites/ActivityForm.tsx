"use client";

import { useState, type FormEvent } from "react";
import { Stepper } from "./Stepper";
import { ChipSelect } from "./ChipSelect";
import {
  ACTIVITY_TYPE_OPTIONS,
  CAMPUS_OPTIONS,
  DURATION_OPTIONS,
  SUPPORT_USED_OPTIONS,
} from "@/lib/config/options";
import { activitySchema, todayISODate } from "@/lib/validation/activity";

const FIXED_SUPPORT_OPTIONS: readonly string[] = SUPPORT_USED_OPTIONS.filter((o) => o !== "Autre");

export type ActivityFormInitialValues = {
  activity_date: string;
  campus: string;
  activity_type: string;
  people_reached: number;
  meaningful_conversations: number;
  interested_people: number;
  support_used: string;
  duration: string;
  note: string;
};

/**
 * Une seule page scrollable (pas de wizard multi-étapes), réutilisée en
 * création et en édition — seul `action` (Server Action) et `initialValues`
 * changent. PRD §4.2.
 */
export function ActivityForm({
  action,
  initialValues,
  submitLabel = "Enregistrer l'activité",
}: {
  action: (formData: FormData) => void | Promise<void>;
  initialValues?: Partial<ActivityFormInitialValues>;
  submitLabel?: string;
}) {
  const [activityDate, setActivityDate] = useState(initialValues?.activity_date ?? todayISODate());
  const [campus, setCampus] = useState(initialValues?.campus ?? CAMPUS_OPTIONS[0]);
  const [activityType, setActivityType] = useState<string | null>(
    initialValues?.activity_type ?? null,
  );
  const [peopleReached, setPeopleReached] = useState(initialValues?.people_reached ?? 0);
  const [meaningfulConversations, setMeaningfulConversations] = useState(
    initialValues?.meaningful_conversations ?? 0,
  );
  const [interestedPeople, setInterestedPeople] = useState(initialValues?.interested_people ?? 0);

  const initialSupportUsed = initialValues?.support_used ?? "";
  const initialSupportIsOther =
    initialSupportUsed !== "" && !FIXED_SUPPORT_OPTIONS.includes(initialSupportUsed);
  const [supportChoice, setSupportChoice] = useState<string | null>(
    initialSupportUsed === "" ? null : initialSupportIsOther ? "Autre" : initialSupportUsed,
  );
  const [supportOther, setSupportOther] = useState(initialSupportIsOther ? initialSupportUsed : "");

  const [duration, setDuration] = useState<string | null>(initialValues?.duration || null);
  const [note, setNote] = useState(initialValues?.note ?? "");

  const [error, setError] = useState<string | null>(null);

  const finalSupportUsed =
    supportChoice === null
      ? ""
      : supportChoice === "Autre"
        ? supportOther.trim() || "Autre"
        : supportChoice;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!activityType) {
      event.preventDefault();
      setError("Merci de choisir un type d'activité.");
      return;
    }

    const parsed = activitySchema.safeParse({
      activity_date: activityDate,
      campus,
      activity_type: activityType,
      people_reached: peopleReached,
      meaningful_conversations: meaningfulConversations,
      interested_people: interestedPeople,
      support_used: finalSupportUsed,
      duration: duration ?? "",
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
      <div>
        <label htmlFor="activity_date" className="mb-1 block text-sm font-medium text-text-strong">
          Date
        </label>
        <input
          id="activity_date"
          name="activity_date"
          type="date"
          required
          max={todayISODate()}
          value={activityDate}
          onChange={(event) => setActivityDate(event.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        />
      </div>

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
        <p className="mb-1 text-sm font-medium text-text-strong">Type d&apos;activité</p>
        <ChipSelect
          name="activity_type"
          options={ACTIVITY_TYPE_OPTIONS}
          value={activityType}
          onChange={setActivityType}
        />
      </div>

      <hr className="border-border-subtle" />

      <div>
        <p className="mb-2 text-sm font-medium text-text-strong">Chiffres de l&apos;activité</p>
        <div className="space-y-2">
          <Stepper
            label="Personnes atteintes"
            name="people_reached"
            value={peopleReached}
            onChange={(next) => {
              setPeopleReached(next);
              if (meaningfulConversations > next) setMeaningfulConversations(next);
              if (interestedPeople > next) setInterestedPeople(next);
            }}
          />
          <Stepper
            label="Conversations significatives"
            name="meaningful_conversations"
            value={meaningfulConversations}
            max={peopleReached}
            onChange={setMeaningfulConversations}
          />
          <Stepper
            label="Personnes intéressées"
            name="interested_people"
            value={interestedPeople}
            max={peopleReached}
            onChange={setInterestedPeople}
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Support utilisé</p>
        <ChipSelect
          name="support_used_choice"
          options={SUPPORT_USED_OPTIONS.map((option) => ({ value: option, label: option }))}
          value={supportChoice}
          onChange={setSupportChoice}
        />
        {supportChoice === "Autre" && (
          <input
            type="text"
            value={supportOther}
            onChange={(event) => setSupportOther(event.target.value)}
            placeholder="Précisez…"
            className="mt-2 w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          />
        )}
        <input type="hidden" name="support_used" value={finalSupportUsed} />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Durée</p>
        <ChipSelect name="duration" options={DURATION_OPTIONS} value={duration} onChange={setDuration} />
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
          placeholder="Observation libre, anonyme"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        />
      </div>

      {error && <p className="text-sm text-bomoi-red">{error}</p>}

      <button
        type="submit"
        disabled={!activityType}
        className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}
