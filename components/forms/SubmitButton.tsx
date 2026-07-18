"use client";

import { useFormStatus } from "react-dom";

/**
 * `useFormStatus` ne lit l'état que d'un `<form>` ANCÊTRE — ce composant doit
 * donc être rendu à l'intérieur du `<form>`, jamais dans le même composant
 * que la balise `<form>` elle-même (le hook y renverrait toujours
 * `pending: false`). Donne un retour visible immédiat au clic
 * (texte + désactivation), plutôt qu'un bouton qui semble ne rien faire
 * pendant l'aller-retour serveur.
 */
export function SubmitButton({
  label,
  pendingLabel = "Enregistrement…",
  disabled = false,
}: {
  label: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white disabled:opacity-40"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
