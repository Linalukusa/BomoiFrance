"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stepper } from "../../Stepper";
import { DEFINITIONS } from "@/lib/config/definitions";
import { incrementCounterAction, incrementBarrierAction, type CounterValues } from "./actions";

type CounterName = keyof CounterValues;

type QueueItem =
  | { kind: "counter"; counter: CounterName; delta: number }
  | { kind: "barrier"; barrierId: string; delta: number };

function clampCounters(prev: CounterValues, counter: CounterName, delta: number): CounterValues {
  const next = { ...prev, [counter]: Math.max(0, prev[counter] + delta) };

  if (counter === "people_reached") {
    if (next.meaningful_conversations > next.people_reached) {
      next.meaningful_conversations = next.people_reached;
    }
    if (next.interested_people > next.people_reached) {
      next.interested_people = next.people_reached;
    }
  } else if (counter === "meaningful_conversations" || counter === "interested_people") {
    next[counter] = Math.min(next[counter], next.people_reached);
  }

  return next;
}

/**
 * Tout l'état vient de la base au chargement ; chaque tap (compteur ou
 * frein) écrit immédiatement via une Server Action appelée directement
 * (pas de <form>, pas de bouton « Enregistrer » — PRD V2 §3). Mise à jour
 * optimiste immédiate, puis réconciliation avec les valeurs autoritaires
 * renvoyées par la RPC (bornage serveur = source de vérité).
 *
 * Erreur réseau : le tap reste en file d'attente en mémoire (jamais perdu
 * silencieusement) et le bandeau "Non enregistré, nouvel essai…" s'affiche
 * tant que la file n'a pas pu se vider. Pas de persistance au rechargement
 * de page — le mode hors-ligne complet reste hors périmètre (PRD V2).
 */
export function TerrainCounters({
  activityId,
  initialCounters,
  barriers,
  initialBarrierCounts,
}: {
  activityId: string;
  initialCounters: CounterValues;
  barriers: readonly { id: string; label: string }[];
  initialBarrierCounts: Record<string, number>;
}) {
  const [counters, setCounters] = useState(initialCounters);
  const [barrierCounts, setBarrierCounts] = useState(initialBarrierCounts);
  const [hasError, setHasError] = useState(false);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Indirection nécessaire pour l'appel récursif du réessai : useCallback ne
  // peut pas se référencer lui-même avant la fin de sa propre déclaration.
  const processQueueRef = useRef<() => void>(() => {});

  const processQueue = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    (async () => {
      while (queueRef.current.length > 0) {
        const item = queueRef.current[0];
        try {
          if (item.kind === "counter") {
            const result = await incrementCounterAction(activityId, item.counter, item.delta);
            setCounters(result);
          } else {
            const result = await incrementBarrierAction(activityId, item.barrierId, item.delta);
            setBarrierCounts((prev) => ({ ...prev, [item.barrierId]: result }));
          }
          queueRef.current.shift();
          setHasError(false);
        } catch {
          setHasError(true);
          processingRef.current = false;
          retryTimeoutRef.current = setTimeout(() => processQueueRef.current(), 3000);
          return;
        }
      }
      processingRef.current = false;
    })();
  }, [activityId]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  function bumpCounter(counter: CounterName, delta: number) {
    setCounters((prev) => clampCounters(prev, counter, delta));
    queueRef.current.push({ kind: "counter", counter, delta });
    processQueue();
  }

  function bumpBarrier(barrierId: string, delta: number) {
    setBarrierCounts((prev) => ({ ...prev, [barrierId]: Math.max(0, (prev[barrierId] ?? 0) + delta) }));
    queueRef.current.push({ kind: "barrier", barrierId, delta });
    processQueue();
  }

  return (
    <div className="space-y-6">
      {hasError && (
        <div className="rounded-xl bg-card-alt px-4 py-3 text-sm text-text-muted">
          Non enregistré, nouvel essai…
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-text-strong">Chiffres de l&apos;action</p>
        <div className="space-y-2">
          <Stepper
            label="Personnes atteintes"
            name="people_reached"
            value={counters.people_reached}
            tooltip={DEFINITIONS.personneSensibilisee}
            onChange={(next) => bumpCounter("people_reached", next - counters.people_reached)}
          />
          <Stepper
            label="Conversations significatives"
            name="meaningful_conversations"
            value={counters.meaningful_conversations}
            max={counters.people_reached}
            tooltip={DEFINITIONS.conversationSignificative}
            onChange={(next) => bumpCounter("meaningful_conversations", next - counters.meaningful_conversations)}
          />
          <Stepper
            label="Personnes intéressées"
            name="interested_people"
            value={counters.interested_people}
            max={counters.people_reached}
            tooltip={DEFINITIONS.personneInteressee}
            onChange={(next) => bumpCounter("interested_people", next - counters.interested_people)}
          />
          <Stepper
            label="Orientations en personne"
            name="orientations_in_person"
            value={counters.orientations_in_person}
            tooltip={DEFINITIONS.orientation}
            onChange={(next) => bumpCounter("orientations_in_person", next - counters.orientations_in_person)}
          />
          <Stepper
            label="Orientations à distance"
            name="orientations_remote"
            value={counters.orientations_remote}
            tooltip={DEFINITIONS.orientation}
            onChange={(next) => bumpCounter("orientations_remote", next - counters.orientations_remote)}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text-strong">Freins entendus</p>
        <div className="space-y-2">
          {barriers.map((barrier) => {
            const count = barrierCounts[barrier.id] ?? 0;
            return (
              <div
                key={barrier.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="min-w-0 flex-1 text-sm text-text-strong">{barrier.label}</span>
                <div className="flex shrink-0 items-center gap-3">
                  {count > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => bumpBarrier(barrier.id, -1)}
                        aria-label={`Retirer une occurrence de ${barrier.label}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card-alt text-lg font-bold text-text-strong"
                      >
                        −
                      </button>
                      <span className="w-6 shrink-0 text-center text-base font-bold text-text-strong">
                        {count}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => bumpBarrier(barrier.id, 1)}
                    aria-label={`Ajouter une occurrence de ${barrier.label}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bomoi-red text-lg font-bold text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
