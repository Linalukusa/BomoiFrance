import { CAMPUS_OPTIONS } from "@/lib/config/options";
import { inviteMediator } from "./actions";

export default async function NouveauMediateurPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  return (
    <div className="flex flex-1 flex-col px-8 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">
            Inviter un médiateur
          </h1>
          <p className="text-sm text-text-secondary">
            Un e-mail de connexion sera envoyé à l&apos;adresse indiquée.
          </p>
        </div>

        {success && (
          <p className="rounded-lg bg-card-alt p-3 text-sm text-text-strong">
            Invitation envoyée.
          </p>
        )}
        {error === "champs_manquants" && (
          <p className="text-sm text-bomoi-red">Merci de remplir tous les champs.</p>
        )}
        {error === "non_autorise" && (
          <p className="text-sm text-bomoi-red">
            Seuls les coordinateurs et administrateurs peuvent inviter un
            médiateur.
          </p>
        )}
        {error && !["champs_manquants", "non_autorise"].includes(error) && (
          <p className="text-sm text-bomoi-red">{decodeURIComponent(error)}</p>
        )}

        <form action={inviteMediator} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-strong">
              Adresse e-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="prenom.nom@univ-toulouse.fr"
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="mb-1 block text-sm font-medium text-text-strong">
                Prénom
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
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
                type="text"
                required
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
              defaultValue=""
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
            >
              <option value="" disabled>
                Sélectionner…
              </option>
              {CAMPUS_OPTIONS.map((campus) => (
                <option key={campus} value={campus}>
                  {campus}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white"
          >
            Envoyer l&apos;invitation
          </button>
        </form>
      </div>
    </div>
  );
}
