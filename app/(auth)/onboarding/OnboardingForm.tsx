"use client";

import { useState } from "react";
import { acceptOnboarding } from "./actions";

export function OnboardingForm({ error }: { error?: string }) {
  const [charterAccepted, setCharterAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  return (
    <form action={acceptOnboarding} className="space-y-6">
      <section className="rounded-xl bg-card-alt p-4">
        <h2 className="mb-2 font-bold text-text-strong">Charte du médiateur</h2>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Neutralité et respect envers chaque personne rencontrée</li>
          <li>Aucune pression, aucun objectif chiffré individuel</li>
          <li>Information fiable, sans jugement sur les choix de chacun</li>
          <li>Confidentialité des échanges de terrain</li>
        </ul>
        <label className="flex items-start gap-2 text-sm text-text-strong">
          <input
            type="checkbox"
            name="charter_accepted"
            checked={charterAccepted}
            onChange={(event) => setCharterAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          J&apos;ai lu et j&apos;accepte la charte du médiateur BOMOI.
        </label>
      </section>

      <section className="rounded-xl bg-card-alt p-4">
        <h2 className="mb-2 font-bold text-text-strong">Protection des données</h2>
        <p className="mb-4 text-sm leading-relaxed text-text-secondary">
          Dans le cadre de votre mission de médiateur BOMOI, vous pouvez être
          amené à recueillir certaines informations lors de vos échanges avec
          le public. Ces informations sont collectées exclusivement afin de
          mesurer l&apos;impact des actions de sensibilisation, mieux
          comprendre les freins au don de sang, améliorer les actions de
          médiation et suivre les orientations vers l&apos;EFS. Aucune donnée
          médicale ne doit être demandée ou enregistrée. Vous vous engagez à
          respecter la confidentialité des échanges, à ne collecter que les
          informations nécessaires, à informer les personnes de la finalité
          de la collecte, à ne jamais partager les données avec des personnes
          non autorisées, et à signaler immédiatement tout incident
          concernant les données. Les données sont traitées conformément au
          RGPD. Vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, de limitation et d&apos;opposition sur vos
          propres données de compte et d&apos;activité — pour les exercer,
          contactez le coordinateur BOMOI.
        </p>
        <label className="flex items-start gap-2 text-sm text-text-strong">
          <input
            type="checkbox"
            name="privacy_accepted"
            checked={privacyAccepted}
            onChange={(event) => setPrivacyAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          J&apos;ai lu et j&apos;accepte les conditions de traitement des
          données personnelles.
        </label>
      </section>

      {error === "engagements_incomplets" && (
        <p className="text-sm text-bomoi-red">
          Les deux engagements doivent être acceptés avant de continuer.
        </p>
      )}
      {error === "enregistrement_impossible" && (
        <p className="text-sm text-bomoi-red">
          Une erreur est survenue, merci de réessayer.
        </p>
      )}

      <button
        type="submit"
        disabled={!charterAccepted || !privacyAccepted}
        className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white disabled:opacity-40"
      >
        Accepter et continuer
      </button>
    </form>
  );
}
