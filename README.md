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

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run lint` — ESLint

## Statut

Étape 1 du plan de développement (socle projet) en cours. Voir `DEVELOPMENT_PLAN.md` pour la suite.
