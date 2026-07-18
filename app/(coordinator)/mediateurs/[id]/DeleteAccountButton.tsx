"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/forms/SubmitButton";

const CONFIRMATION_WORD = "SUPPRIMER";

/**
 * Double confirmation (PRD §4.6) : un premier clic révèle un avertissement
 * explicite + un champ où l'admin doit recopier "SUPPRIMER" avant que le
 * bouton final ne s'active — jamais une seule case à cocher.
 */
export function DeleteAccountButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-full border border-bomoi-red px-5 py-3 text-sm font-bold text-bomoi-red"
      >
        Supprimer définitivement ce compte
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm font-medium text-bomoi-red">
        Cette action est irréversible : elle supprime définitivement le compte, y compris son accès
        coordinateur/admin éventuel, et toutes ses activités, orientations et freins associés.
      </p>
      <label htmlFor="confirmation" className="block text-sm text-text-strong">
        Tapez {CONFIRMATION_WORD} pour confirmer
      </label>
      <input
        id="confirmation"
        name="confirmation"
        autoComplete="off"
        value={confirmationText}
        onChange={(event) => setConfirmationText(event.target.value)}
        className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmationText("");
          }}
          className="flex-1 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold text-text-strong"
        >
          Annuler
        </button>
        <div className="flex-1">
          <SubmitButton
            label="Confirmer la suppression"
            pendingLabel="Suppression…"
            disabled={confirmationText !== CONFIRMATION_WORD}
          />
        </div>
      </div>
    </form>
  );
}
