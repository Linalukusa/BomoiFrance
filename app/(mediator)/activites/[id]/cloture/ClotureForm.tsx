"use client";

import { useCallback, useRef, useState } from "react";
import { ChipSelect } from "../../ChipSelect";
import { ChipMultiSelect } from "@/components/forms/ChipMultiSelect";
import { SubmitButton } from "@/components/forms/SubmitButton";
import {
  PERIOD_OPTIONS,
  AUDIENCE_OPTIONS,
  EVENT_CONTEXT_OPTIONS,
  SUPPORT_USED_OPTIONS,
} from "@/lib/config/options";
import { updateActivityField, addMisconception, removeMisconception, closeActivityAction } from "./actions";

const PRIVACY_NOTICE = "Jamais de nom, de contact ni de détail de santé.";
const FIXED_SUPPORT_OPTIONS: readonly string[] = SUPPORT_USED_OPTIONS.filter((o) => o !== "Autre");

function toLocalTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function applyLocalTime(iso: string, timeValue: string): string | null {
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const base = new Date(iso);
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
}

type Misconception = { id: string; content: string; barrier_id: string | null };

/**
 * Sauvegarde automatique, champ par champ, jamais de bouton "Enregistrer"
 * avant le bouton final "Clôturer l'action" (PRD V2 §3). Les champs texte
 * sauvegardent à la perte du focus ET après ~800ms d'inactivité (au cas où
 * l'utilisateur ne quitte jamais le champ) ; les chips/bascules
 * sauvegardent immédiatement au tap, pas de saisie continue à attendre.
 *
 * Le journal de bord (3 questions, Étape 13) n'apparaît volontairement pas
 * ici : il dépend de app_settings.research_collection_enabled et du
 * consentement recherche du médiateur, deux éléments qui n'existent pas
 * encore avant l'Étape 13 — voir DEVELOPMENT_PLAN.md.
 */
export function ClotureForm({
  activityId,
  startedAt,
  endedAt,
  initialPeriod,
  initialAudience,
  initialEventContext,
  initialSupportsUsed,
  initialWorkedWell,
  initialMediaCaptured,
  barriers,
  initialMisconceptions,
}: {
  activityId: string;
  startedAt: string | null;
  endedAt: string | null;
  initialPeriod: string | null;
  initialAudience: string | null;
  initialEventContext: string | null;
  initialSupportsUsed: string[];
  initialWorkedWell: string;
  initialMediaCaptured: boolean;
  barriers: readonly { id: string; label: string }[];
  initialMisconceptions: Misconception[];
}) {
  const [startTime, setStartTime] = useState(toLocalTimeInputValue(startedAt));
  const [endTime, setEndTime] = useState(toLocalTimeInputValue(endedAt));
  const [timeError, setTimeError] = useState<string | null>(null);

  const [period, setPeriod] = useState<string | null>(initialPeriod);
  const [audience, setAudience] = useState<string | null>(initialAudience);
  const [eventContext, setEventContext] = useState<string | null>(initialEventContext);

  const hasCustomSupport = initialSupportsUsed.some(
    (s) => !(FIXED_SUPPORT_OPTIONS as readonly string[]).includes(s) && s !== "Autre",
  );
  const customSupportEntry = initialSupportsUsed.find(
    (s) => !(FIXED_SUPPORT_OPTIONS as readonly string[]).includes(s) && s !== "Autre",
  );
  const [supportChips, setSupportChips] = useState<string[]>(
    initialSupportsUsed
      .filter((s) => (FIXED_SUPPORT_OPTIONS as readonly string[]).includes(s))
      .concat(hasCustomSupport || initialSupportsUsed.includes("Autre") ? ["Autre"] : []),
  );
  const [supportOther, setSupportOther] = useState(customSupportEntry ?? "");

  const [workedWell, setWorkedWell] = useState(initialWorkedWell);
  const [mediaCaptured, setMediaCaptured] = useState(initialMediaCaptured);

  const [misconceptions, setMisconceptions] = useState<Misconception[]>(initialMisconceptions);
  const [newMisconception, setNewMisconception] = useState("");
  const [newMisconceptionBarrier, setNewMisconceptionBarrier] = useState("");
  const [misconceptionError, setMisconceptionError] = useState<string | null>(null);

  const [saveError, setSaveError] = useState(false);
  const workedWellTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveField = useCallback(
    async (field: string, value: string | string[] | boolean | null) => {
      try {
        await updateActivityField(activityId, field, value);
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    },
    [activityId],
  );

  function handleTimeBlur(which: "start" | "end") {
    setTimeError(null);
    const currentStart = which === "start" ? startTime : startTime;
    const currentEnd = which === "end" ? endTime : endTime;
    if (currentStart && currentEnd && currentEnd < currentStart) {
      setTimeError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    const referenceIso = which === "start" ? startedAt : endedAt;
    const timeValue = which === "start" ? startTime : endTime;
    if (!referenceIso || !timeValue) return;

    const nextIso = applyLocalTime(referenceIso, timeValue);
    if (!nextIso) return;

    saveField(which === "start" ? "started_at" : "ended_at", nextIso);
  }

  function handleSupportChange(nextChips: string[]) {
    setSupportChips(nextChips);
    const finalValues = nextChips.map((chip) =>
      chip === "Autre" ? supportOther.trim() || "Autre" : chip,
    );
    saveField("supports_used", finalValues);
  }

  function handleSupportOtherBlur() {
    if (!supportChips.includes("Autre")) return;
    const finalValues = supportChips.map((chip) => (chip === "Autre" ? supportOther.trim() || "Autre" : chip));
    saveField("supports_used", finalValues);
  }

  function handleWorkedWellChange(value: string) {
    setWorkedWell(value);
    if (workedWellTimeout.current) clearTimeout(workedWellTimeout.current);
    workedWellTimeout.current = setTimeout(() => saveField("worked_well", value || null), 800);
  }

  function handleWorkedWellBlur() {
    if (workedWellTimeout.current) clearTimeout(workedWellTimeout.current);
    saveField("worked_well", workedWell || null);
  }

  function toggleMediaCaptured(value: boolean) {
    setMediaCaptured(value);
    saveField("media_captured", value);
  }

  async function handleAddMisconception() {
    setMisconceptionError(null);
    const trimmed = newMisconception.trim();
    if (!trimmed) {
      setMisconceptionError("Merci de décrire l'idée reçue.");
      return;
    }

    try {
      const created = await addMisconception(activityId, trimmed, newMisconceptionBarrier || null);
      setMisconceptions((prev) => [...prev, created]);
      setNewMisconception("");
      setNewMisconceptionBarrier("");
    } catch (err) {
      setMisconceptionError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  async function handleRemoveMisconception(id: string) {
    setMisconceptions((prev) => prev.filter((m) => m.id !== id));
    try {
      await removeMisconception(id);
    } catch {
      setSaveError(true);
    }
  }

  const barrierLabelById = Object.fromEntries(barriers.map((b) => [b.id, b.label]));

  return (
    <div className="space-y-6 pb-28">
      {saveError && (
        <div className="rounded-xl bg-card-alt px-4 py-3 text-sm text-text-muted">
          Non enregistré, nouvel essai…
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-text-strong">Heures</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start_time" className="mb-1 block text-xs text-text-muted">
              Début
            </label>
            <input
              id="start_time"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              onBlur={() => handleTimeBlur("start")}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
          </div>
          <div>
            <label htmlFor="end_time" className="mb-1 block text-xs text-text-muted">
              Fin
            </label>
            <input
              id="end_time"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              onBlur={() => handleTimeBlur("end")}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
          </div>
        </div>
        {timeError && <p className="mt-1 text-sm text-bomoi-red">{timeError}</p>}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Période (facultatif)</p>
        <ChipSelect
          name="period"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(value) => {
            setPeriod(value);
            saveField("period", value);
          }}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Public (facultatif)</p>
        <ChipSelect
          name="audience"
          options={AUDIENCE_OPTIONS}
          value={audience}
          onChange={(value) => {
            setAudience(value);
            saveField("audience", value);
          }}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Événement associé (facultatif)</p>
        <ChipSelect
          name="event_context"
          options={EVENT_CONTEXT_OPTIONS}
          value={eventContext}
          onChange={(value) => {
            setEventContext(value);
            saveField("event_context", value);
          }}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Supports utilisés (facultatif)</p>
        <ChipMultiSelect
          name="supports_used"
          options={SUPPORT_USED_OPTIONS.map((option) => ({ value: option, label: option }))}
          value={supportChips}
          onChange={handleSupportChange}
        />
        {supportChips.includes("Autre") && (
          <input
            type="text"
            value={supportOther}
            onChange={(event) => setSupportOther(event.target.value)}
            onBlur={handleSupportOtherBlur}
            placeholder="Précisez…"
            className="mt-2 w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          />
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text-strong">Idées reçues entendues (facultatif)</p>
        {misconceptions.length > 0 && (
          <ul className="mb-3 space-y-2">
            {misconceptions.map((misconception) => (
              <li
                key={misconception.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-strong">{misconception.content}</p>
                  {misconception.barrier_id && barrierLabelById[misconception.barrier_id] && (
                    <p className="mt-0.5 text-xs text-text-muted">
                      {barrierLabelById[misconception.barrier_id]}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMisconception(misconception.id)}
                  aria-label="Retirer cette idée reçue"
                  className="shrink-0 text-text-muted"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
          <input
            type="text"
            value={newMisconception}
            onChange={(event) => setNewMisconception(event.target.value.slice(0, 200))}
            placeholder="Ex. « Il faut être à jeun pour donner son sang »"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          />
          <p className="text-xs text-text-muted">{PRIVACY_NOTICE}</p>
          <select
            value={newMisconceptionBarrier}
            onChange={(event) => setNewMisconceptionBarrier(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          >
            <option value="">Catégorie de frein (facultatif)</option>
            {barriers.map((barrier) => (
              <option key={barrier.id} value={barrier.id}>
                {barrier.label}
              </option>
            ))}
          </select>
          {misconceptionError && <p className="text-sm text-bomoi-red">{misconceptionError}</p>}
          <button
            type="button"
            onClick={handleAddMisconception}
            className="w-full rounded-full border border-bomoi-red px-4 py-2 text-sm font-bold text-bomoi-red"
          >
            + Ajouter
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="worked_well" className="mb-1 block text-sm font-medium text-text-strong">
          Ce qui a bien fonctionné (facultatif)
        </label>
        <textarea
          id="worked_well"
          rows={3}
          maxLength={500}
          value={workedWell}
          onChange={(event) => handleWorkedWellChange(event.target.value)}
          onBlur={handleWorkedWellBlur}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        />
        <p className="mt-1 text-xs text-text-muted">{PRIVACY_NOTICE}</p>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text-strong">Action photographiée ou filmée</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => toggleMediaCaptured(true)}
            className={`flex-1 rounded-full border px-4 py-2 text-sm font-bold ${
              mediaCaptured ? "border-bomoi-red bg-bomoi-red text-white" : "border-border bg-card text-text-strong"
            }`}
          >
            Oui
          </button>
          <button
            type="button"
            onClick={() => toggleMediaCaptured(false)}
            className={`flex-1 rounded-full border px-4 py-2 text-sm font-bold ${
              !mediaCaptured ? "border-bomoi-red bg-bomoi-red text-white" : "border-border bg-card text-text-strong"
            }`}
          >
            Non
          </button>
        </div>
      </div>

      <form action={closeActivityAction.bind(null, activityId)}>
        <SubmitButton label="Clôturer l'action" pendingLabel="Clôture…" />
      </form>
    </div>
  );
}
