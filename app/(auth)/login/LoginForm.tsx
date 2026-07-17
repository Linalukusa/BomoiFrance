"use client";

import { useState, type FormEvent } from "react";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

/**
 * GoTrue catégorise en interne le jeton envoyé selon l'état du compte
 * (première confirmation d'une invitation vs connexion habituelle), et
 * verifyOtp échoue avec "otp_expired" si le "type" fourni ne correspond
 * pas à cette catégorie — même pour un code tout juste reçu. On essaie les
 * types plausibles dans l'ordre plutôt que de dépendre d'une seule
 * hypothèse invérifiable sans accès direct au projet Supabase.
 */
const OTP_TYPE_CANDIDATES: EmailOtpType[] = ["email", "invite", "magiclink", "signup"];

/**
 * Connexion par code à 6 chiffres saisi manuellement (pas de lien cliquable).
 * Les liens envoyés par e-mail sont fréquemment pré-visités automatiquement
 * par les messageries/antivirus (aperçus Gmail, Safe Links Outlook, scanners
 * de sécurité), ce qui consomme silencieusement un jeton à usage unique
 * avant le vrai clic de l'utilisateur — un code que la personne recopie
 * elle-même ne peut pas être consommé à sa place. Voir README.md
 * « Authentification ».
 */
export function LoginForm({ initialError }: { initialError?: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState(initialError ?? "");

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(translateAuthError(error.message));
      return;
    }

    setStatus("idle");
    setStep("code");
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    let lastError: { message: string } | null = null;

    for (const type of OTP_TYPE_CANDIDATES) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
      if (!error) {
        // Rechargement complet (pas de router.push) : le proxy doit relire la
        // session tout juste établie pour décider de la redirection
        // (onboarding, accueil ou dashboard selon le rôle).
        window.location.assign("/");
        return;
      }
      lastError = error;
      // "otp_expired" couvre aussi bien "vraiment expiré" que "type de jeton
      // non trouvé" côté GoTrue : on continue d'essayer les autres types.
      // Toute autre erreur (ex. code à 6 chiffres mal saisi) est définitive.
      if (error.message.toLowerCase().includes("expired") === false) {
        break;
      }
    }

    setStatus("error");
    setErrorMessage(translateAuthError(lastError?.message ?? ""));
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

      {step === "email" ? (
        <form onSubmit={handleRequestCode} className="w-full max-w-sm space-y-4">
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

          {errorMessage && <p className="text-sm text-bomoi-red">{errorMessage}</p>}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {status === "loading" ? "Envoi en cours…" : "Continuer"}
          </button>

          <p className="text-center text-xs text-text-muted">
            Première connexion ? Utilisez l&apos;e-mail transmis par votre
            coordinateur.
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="w-full max-w-sm space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-text-secondary">
            Un code à 6 chiffres a été envoyé à <strong>{email}</strong>.
          </div>

          <div>
            <label
              htmlFor="code"
              className="mb-1 block text-sm font-medium text-text-strong"
            >
              Code de connexion
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-center text-2xl tracking-[0.5em] text-text-strong placeholder:tracking-normal placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
          </div>

          {errorMessage && <p className="text-sm text-bomoi-red">{errorMessage}</p>}

          <button
            type="submit"
            disabled={status === "loading" || code.length !== 6}
            className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {status === "loading" ? "Vérification…" : "Se connecter"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setErrorMessage("");
            }}
            className="w-full text-center text-xs text-text-muted underline underline-offset-2"
          >
            Utiliser une autre adresse e-mail
          </button>
        </form>
      )}
    </div>
  );
}
