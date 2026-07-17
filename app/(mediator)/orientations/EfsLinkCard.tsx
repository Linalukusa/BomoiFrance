"use client";

import { useState } from "react";

export function EfsLinkCard({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission refusée) :
      // le lien reste visible et sélectionnable manuellement, aucune action requise.
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium text-text-strong">Mon lien EFS à partager</p>
      <p className="mb-3 break-all rounded-lg bg-card-alt px-3 py-2 text-sm text-text-secondary">{link}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="w-full rounded-full border border-border bg-card-alt px-4 py-2 text-sm font-bold text-text-strong"
      >
        {copied ? "Copié !" : "Copier le lien"}
      </button>
    </div>
  );
}
