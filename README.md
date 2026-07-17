# BOMOI Mediation Hub

Application de suivi de la médiation par les pairs pour le don de sang, en partenariat avec l'EFS Occitanie. Voir la documentation avant toute contribution :

- [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md) — cahier des charges V1, RGPD, définitions verrouillées
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — architecture technique et design system
- [`SECURITY.md`](./SECURITY.md) — politiques de sécurité et de confidentialité
- [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) — plan de développement par étapes

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner les valeurs Supabase (voir ci-dessous)
npm run dev
```

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Appliquer la migration : `supabase link --project-ref <ref>` puis `supabase db push` (ou coller le contenu de `supabase/migrations/0001_init.sql` dans le SQL Editor du dashboard).
3. Renseigner dans `.env.local` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API).
4. Vérifier la connexion : `curl http://localhost:3000/api/health` doit renvoyer `{"ok":true,"barriersSeeded":11}`.

## Authentification (Étape 2)

Pas d'auto-inscription : les comptes sont créés par invitation (admin ou coordinateur). Connexion par **code à 6 chiffres saisi manuellement** — pas par lien cliquable.

### Pourquoi un code plutôt qu'un lien

Première implémentation : lien magique cliquable. Écarté en pratique — de nombreux clients e-mail et antivirus (aperçus de lien Gmail, Safe Links Outlook, scanners de sécurité) **suivent automatiquement les liens contenus dans un e-mail pour les vérifier**, avant même que la personne ne clique. Comme les jetons de connexion Supabase sont à usage unique, ce pré-scan les consomme silencieusement — la personne reçoit alors systématiquement une erreur « lien expiré » en cliquant, quelques secondes après avoir reçu l'e-mail. Un code recopié manuellement ne peut pas être consommé à la place de l'utilisateur : c'est la seule solution robuste face à un pré-scan qu'on ne contrôle pas.

Flux : `supabase.auth.signInWithOtp({ email })` envoie le code, `supabase.auth.verifyOtp({ email, token, type: "email" })` le vérifie une fois saisi dans `/login`.

### Réglage Supabase à faire une seule fois

**Authentication → Email Templates**, sur les templates **Magic Link** et **Invite user** : le corps de l'e-mail doit afficher clairement `{{ .Token }}` (le code à 6 chiffres), par exemple :
```html
<h2>{{ .Token }}</h2>
<p>Saisissez ce code sur la page de connexion de BOMOI Mediation Hub.</p>
```
Le lien `{{ .ConfirmationURL }}` par défaut peut rester dans le template (il n'est plus utilisé par l'application, `/auth/confirm` n'existe plus) ou être retiré, au choix — sans effet fonctionnel.

Aucun réglage de `Redirect URLs`/`Site URL` n'est requis pour ce flux (nécessaire uniquement pour les liens cliquables, qu'on n'utilise plus).

### Créer le premier compte admin (bootstrap, une seule fois)

L'application ne permet pas de se nommer soi-même admin : la seule voie légitime (`set_user_role`) exige déjà d'être admin. Le tout premier compte se crée donc directement dans Supabase :

1. Dashboard → **Authentication → Users → Add user → Send invite email**, avec l'e-mail de la première personne admin.
2. Dans le **SQL Editor**, une fois l'utilisateur créé (récupérer son `id` dans la table Authentication → Users) :
   ```sql
   insert into public.profiles (id, role) values ('<uuid-de-l-utilisateur>', 'admin');
   ```
   (Pas de ligne `mediators` à créer pour un compte admin/coordinateur — cette table ne concerne que le rôle `mediator`.)
3. La personne admin va sur `/login`, saisit son e-mail, reçoit un code à 6 chiffres et le saisit. Elle arrive directement sur `/dashboard` (pas d'onboarding pour ce rôle), et peut ensuite inviter les médiateurs depuis « + Inviter un médiateur ».

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run lint` — ESLint

## Statut

Étape 2 du plan de développement (authentification et onboarding) prête pour vérification en conditions réelles. Voir `DEVELOPMENT_PLAN.md` pour le détail et la suite.
