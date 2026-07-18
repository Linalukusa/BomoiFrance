"use client";

import { useEffect, useState } from "react";

/**
 * Confirmation visuelle après un enregistrement réussi (redirection serveur
 * vers `?saved=1`). Nettoie le paramètre de l'URL au montage (`replaceState`,
 * pas de navigation Next.js) pour qu'un simple rechargement de page ne
 * réaffiche pas le message.
 */
export function SuccessBanner({ message = "Enregistré avec succès." }: { message?: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("saved")) {
      url.searchParams.delete("saved");
      window.history.replaceState({}, "", url.toString());
    }

    const timeout = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-border-subtle bg-card-alt px-4 py-3 text-sm text-text-strong">
      <span aria-hidden className="font-bold text-bomoi-red">
        ✓
      </span>
      <span>{message}</span>
    </div>
  );
}
