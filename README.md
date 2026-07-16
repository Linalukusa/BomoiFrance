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

Pas d'auto-inscription : les comptes sont créés par invitation (admin ou coordinateur), connexion par lien magique envoyé par e-mail. Deux réglages Supabase à faire une seule fois, dans le dashboard :

1. **Authentication → URL Configuration** : renseigner le `Site URL` (ex. `https://bomoi-mediation-hub.vercel.app`) et ajouter `https://bomoi-mediation-hub.vercel.app/auth/confirm` (et l'équivalent `http://localhost:3000/auth/confirm` pour le local) dans `Redirect URLs`. Sans ça, Supabase refuse les liens de connexion/invitation.
2. **Authentication → Email Templates** : vérifier que les templates « Magic Link » et « Invite user » utilisent bien `{{ .TokenHash }}` et `{{ .Type }}` dans l'URL de confirmation (`/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}`) — c'est le format par défaut, à ne pas modifier.

### Créer le premier compte admin (bootstrap, une seule fois)

L'application ne permet pas de se nommer soi-même admin : la seule voie légitime (`set_user_role`) exige déjà d'être admin. Le tout premier compte se crée donc directement dans Supabase :

1. Dashboard → **Authentication → Users → Add user → Send invite email**, avec l'e-mail de la première personne admin.
2. Dans le **SQL Editor**, une fois l'utilisateur créé (récupérer son `id` dans la table Authentication → Users) :
   ```sql
   insert into public.profiles (id, role) values ('<uuid-de-l-utilisateur>', 'admin');
   ```
   (Pas de ligne `mediators` à créer pour un compte admin/coordinateur — cette table ne concerne que le rôle `mediator`.)
3. La personne admin clique le lien reçu par e-mail, arrive directement sur `/dashboard` (pas d'onboarding pour ce rôle), et peut ensuite inviter les médiateurs depuis « + Inviter un médiateur ».

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run lint` — ESLint

## Statut

Étape 2 du plan de développement (authentification et onboarding) prête pour vérification en conditions réelles. Voir `DEVELOPMENT_PLAN.md` pour le détail et la suite.
