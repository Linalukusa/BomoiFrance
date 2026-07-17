import { confirmSignIn } from "./actions";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    code?: string;
    next?: string;
  }>;
}) {
  const { token_hash, type, code, next } = await searchParams;
  // {{ .Type }} est vide dans les e-mails Supabase quand le projet est en
  // flux PKCE (reconnaissable au préfixe "pkce_" sur token_hash) — ce n'est
  // pas une erreur de template, juste une variable non renseignée dans ce
  // mode. La Server Action retombe alors sur un type générique.
  const hasToken = Boolean(token_hash || code);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-page px-6 py-16">
      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-ink text-2xl font-extrabold text-white">
        B
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-text-strong">BOMOI</p>
        <p className="text-sm text-text-muted">Mediation Hub</p>
      </div>

      {hasToken ? (
        <>
          <p className="max-w-xs text-center text-sm text-text-secondary">
            Cliquez pour finaliser votre connexion.
          </p>
          <form action={confirmSignIn} className="w-full max-w-sm">
            {token_hash && <input type="hidden" name="token_hash" value={token_hash} />}
            {type && <input type="hidden" name="type" value={type} />}
            {code && <input type="hidden" name="code" value={code} />}
            <input type="hidden" name="next" value={next ?? "/"} />
            <button
              type="submit"
              className="w-full rounded-full bg-bomoi-red px-5 py-3 font-bold text-white"
            >
              Se connecter
            </button>
          </form>
        </>
      ) : (
        <p className="max-w-xs text-center text-sm text-bomoi-red">
          Ce lien de connexion n&apos;est plus valide. Merci d&apos;en
          redemander un depuis la page de connexion.
        </p>
      )}
    </div>
  );
}
