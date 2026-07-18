"use client";

import { useState, type FormEvent } from "react";
import { CAMPUS_OPTIONS, MEDIATOR_STATUS_OPTIONS } from "@/lib/config/options";
import { mediatorSchema } from "@/lib/validation/mediator";
import { SubmitButton } from "@/components/forms/SubmitButton";

export type MediatorFormInitialValues = {
  first_name: string;
  last_name: string;
  university: string;
  status: string;
  availability: string;
  languages: string;
};

export function MediatorForm({
  action,
  initialValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initialValues: MediatorFormInitialValues;
}) {
  const [firstName, setFirstName] = useState(initialValues.first_name);
  const [lastName, setLastName] = useState(initialValues.last_name);
  const [university, setUniversity] = useState(initialValues.university);
  const [status, setStatus] = useState(initialValues.status);
  const [availability, setAvailability] = useState(initialValues.availability);
  const [languages, setLanguages] = useState(initialValues.languages);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = mediatorSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      university,
      status,
      availability,
      languages,
    });

    if (!parsed.success) {
      event.preventDefault();
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
      return;
    }

    setError(null);
  }

  const universityKnown = (CAMPUS_OPTIONS as readonly string[]).includes(university);

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="first_name" className="mb-1 block text-sm font-medium text-text-strong">
            Prénom
          </label>
          <input
            id="first_name"
            name="first_name"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          />
        </div>
        <div>
          <label htmlFor="last_name" className="mb-1 block text-sm font-medium text-text-strong">
            Nom
          </label>
          <input
            id="last_name"
            name="last_name"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
          />
        </div>
      </div>

      <div>
        <label htmlFor="university" className="mb-1 block text-sm font-medium text-text-strong">
          Université / campus
        </label>
        <select
          id="university"
          name="university"
          required
          value={university}
          onChange={(event) => setUniversity(event.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        >
          {!universityKnown && university && <option value={university}>{university}</option>}
          {CAMPUS_OPTIONS.map((campus) => (
            <option key={campus} value={campus}>
              {campus}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium text-text-strong">
          Statut
        </label>
        <select
          id="status"
          name="status"
          required
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        >
          {MEDIATOR_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="languages" className="mb-1 block text-sm font-medium text-text-strong">
          Langues parlées (séparées par des virgules)
        </label>
        <input
          id="languages"
          name="languages"
          value={languages}
          onChange={(event) => setLanguages(event.target.value)}
          placeholder="Français, Anglais, Espagnol"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        />
      </div>

      <div>
        <label htmlFor="availability" className="mb-1 block text-sm font-medium text-text-strong">
          Disponibilité (facultatif)
        </label>
        <input
          id="availability"
          name="availability"
          value={availability}
          onChange={(event) => setAvailability(event.target.value)}
          placeholder="Ex. lundis et mercredis après-midi"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
        />
      </div>

      {error && <p className="text-sm text-bomoi-red">{error}</p>}

      <SubmitButton label="Enregistrer les modifications" />
    </form>
  );
}
