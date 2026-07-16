export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-page px-6 text-center">
      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-ink text-2xl font-extrabold text-white">
        B
      </div>
      <div>
        <p className="text-xl font-bold text-text-strong">BOMOI</p>
        <p className="text-sm text-text-muted">Mediation Hub</p>
      </div>
      <p className="max-w-xs text-sm text-text-secondary">
        Socle du projet en cours de construction (Étape 1 du plan de
        développement). L&apos;authentification arrive à l&apos;étape suivante.
      </p>
    </div>
  );
}
