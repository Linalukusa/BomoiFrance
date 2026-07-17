"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white disabled:opacity-60"
    >
      {pending ? "Envoi en cours…" : "Envoyer l'invitation"}
    </button>
  );
}
