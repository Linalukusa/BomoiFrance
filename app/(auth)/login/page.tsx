"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-page px-6 py-16">
      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-ink text-2xl font-extrabold text-white">
        B
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-text-strong">BOMOI</p>
        <p className="text-sm text-text-muted">Mediation Hub</p>
      </div>
      <p className="max-w-xs text-center text-sm text-text-secondary">
        Sensibilisation au don du sang en partenariat avec l&apos;EFS Occitanie
      </p>

      {status === "sent" ? (
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 text-center text-sm text-text-secondary">
          Un lien de connexion a été envoyé à <strong>{email}</strong>. Ouvrez-le
          depuis cet appareil pour vous connecter.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-text-strong"
            >
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="prenom.nom@univ-toulouse.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-bomoi-red">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {status === "sending" ? "Envoi en cours…" : "Continuer"}
          </button>

          <p className="text-center text-xs text-text-muted">
            Première connexion ? Utilisez l&apos;e-mail transmis par votre
            coordinateur.
          </p>
        </form>
      )}
    </div>
  );
}
