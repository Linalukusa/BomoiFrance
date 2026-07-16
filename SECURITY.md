# Politiques de sécurité et de confidentialité — BOMOI Mediation Hub

Ce document complète la section RGPD de `PRODUCT_REQUIREMENTS.md` (§6) avec les mécanismes techniques concrets. Il doit être tenu à jour à chaque évolution du schéma ou des policies.

## 1. Principe général

Aucune donnée permettant d'identifier une personne sensibilisée ou orientée n'existe dans le système, à aucun niveau (schéma, code, logs, sauvegardes). Ce n'est pas une politique de restriction d'accès à des données sensibles — c'est une absence structurelle de la donnée elle-même. Toute proposition future d'ajouter un champ nom/contact/identifiant sur `orientations` ou toute table liée à une personne sensibilisée doit être refusée par défaut, y compris « en option » ou « pour plus tard ».

## 2. Row Level Security — matrice par table et par rôle

RLS est activée sur les 9 tables dès `0001_init.sql`. Aucune table exposée à PostgREST/supabase-js ne doit jamais avoir RLS désactivée.

| Table | mediator | coordinator | admin |
|---|---|---|---|
| `profiles` | SELECT/UPDATE ligne propre (rôle non modifiable) | SELECT toutes | SELECT/UPDATE/DELETE toutes, rôle via `set_user_role()` uniquement |
| `mediators` | SELECT/UPDATE ligne propre | SELECT/INSERT/UPDATE toutes | + DELETE définitif |
| `activities` | SELECT/INSERT/UPDATE (dont archivage) ligne propre uniquement | SELECT toutes (lecture seule) | + DELETE définitif |
| `orientations` | idem, jamais de champ identifiant | SELECT toutes | + DELETE définitif |
| `barriers` | SELECT (catalogue fixe) | SELECT | + gestion du catalogue |
| `activity_barriers` | SELECT/INSERT/UPDATE liés à ses activités | SELECT toutes | + DELETE définitif |
| `link_clicks` | SELECT ligne propre ; écriture uniquement via RPC `get_or_create_efs_link` | SELECT toutes | + DELETE définitif |
| `aggregate_collection_results` | SELECT (pour choisir la collecte dans le formulaire orientation) | SELECT | INSERT/UPDATE/DELETE (saisie officielle) |
| `audit_logs` | aucun accès | aucun accès (par défaut — activable si BOMOI le souhaite) | SELECT |

Aucun rôle applicatif (`mediator`/`coordinator`) ne dispose jamais d'une policy DELETE sur les tables de données de terrain : la suppression définitive est réservée à `admin`, et toute suppression déclenche un trigger `log_hard_delete` vers `audit_logs` avant la suppression effective (snapshot complet de la ligne dans `metadata`).

## 3. Élévation de privilèges contrôlée

Deux opérations nécessitent plus que ce que RLS autorise pour un utilisateur normal :

1. **Changement de rôle** (`profiles.role`) : jamais par une simple requête `UPDATE`. Un trigger `prevent_role_self_change` bloque toute tentative hors admin, et la seule voie légitime est la fonction `SECURITY DEFINER` `set_user_role(user_id, new_role)`, appelée depuis une Server Action Next.js qui vérifie elle-même la session admin avant l'appel. Chaque changement est journalisé automatiquement dans `audit_logs`.
2. **Invitation d'un médiateur** (création `auth.users` + `profiles` + `mediators`) : passe par une Route Handler serveur utilisant `SUPABASE_SERVICE_ROLE_KEY`. Cette clé n'est **jamais** envoyée au client, n'est **jamais** préfixée `NEXT_PUBLIC_`, et n'est utilisée que dans du code exécuté côté serveur (Route Handlers, Server Actions).

## 4. Module de tracking EFS — anti-bot sans conservation d'IP

- La génération d'un lien court passe par `get_or_create_efs_link()`, `SECURITY DEFINER`, appelable uniquement par un médiateur authentifié pour lui-même.
- Le clic public (personne sensibilisée, non authentifiée) passe par `app/r/[slug]/route.ts`, qui incrémente `click_count` via le client `service_role` (contourne RLS par nature, c'est le seul endroit du code autorisé à le faire pour cette table).
- Anti-bot : rate-limiting **en mémoire/edge**, fenêtre courte (quelques secondes à quelques minutes), sans jamais écrire l'IP en base de données ni dans un log persistant au-delà de la durée de rétention standard des logs applicatifs (12 mois, logs Vercel — pas une table applicative BOMOI).
- Aucune table `link_click_events` par-clic n'existe : c'est un choix de conception délibéré pour qu'il n'y ait techniquement aucun endroit où une IP pourrait être associée à un individu dans la base de données applicative.

## 5. Suppression et archivage

- **Médiateur** : toute action de suppression dans l'UI déclenche un `UPDATE ... SET archived_at = now()`, jamais un `DELETE`. Aucune policy RLS DELETE n'existe pour le rôle mediator — même une tentative d'appel direct à l'API échouerait.
- **Admin** : suppression définitive avec confirmation explicite à deux niveaux dans l'UI (bouton de confirmation + saisie d'un mot de confirmation, ex. « SUPPRIMER »), journalisée automatiquement (trigger `log_hard_delete`, snapshot complet avant suppression).
- **Dashboards et compteurs** : toute requête d'agrégation (vues `v_dashboard_*` recommandées dans `ARCHITECTURE.md`) filtre systématiquement `archived_at IS NULL`. Revue de code obligatoire sur ce point à chaque nouvelle requête d'agrégation.

## 6. Rétention et purge

Voir `PRODUCT_REQUIREMENTS.md` §6.3 pour les durées (à confirmer par BOMOI). Recommandations techniques :

- Les colonnes `created_at`/`archived_at`/`status` (mediators) permettent d'écrire dès maintenant des requêtes de purge (`DELETE ... WHERE created_at < now() - interval '...'`), packagées comme scripts SQL versionnés dans `supabase/migrations/` ou comme fonctions admin déclenchables manuellement — **pas d'automatisation silencieuse en V1** tant que les durées définitives ne sont pas confirmées par BOMOI.
- Anonymisation des comptes médiateurs inactifs : remplacer `first_name`/`last_name` par une valeur générique et vider `languages`/`availability`, sans supprimer les lignes `activities`/`orientations` déjà liées (elles restent statistiquement utiles et sont déjà anonymes par construction).

## 7. Secrets et environnement

- `SUPABASE_SERVICE_ROLE_KEY` : variable d'environnement serveur Vercel uniquement, jamais commitée, jamais dans un fichier `.env` versionné (utiliser `.env.local` ignoré par git + Vercel Environment Variables).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : publique par design (protégée par RLS, pas par le secret).
- Revue systématique avant tout commit : `git status`/`git diff` pour repérer un fichier `.env*` qui se serait glissé dans le staging.

## 8. Incidents

Le texte RGPD d'onboarding engage chaque médiateur à « signaler immédiatement tout incident concernant les données ». Le contact du coordinateur BOMOI doit être affiché de façon permanente et facile à trouver (profil, écran d'onboarding, pied de page du dashboard).

## 9. Revue avant mise en production

Checklist minimale avant tout déploiement V1 :

- [ ] `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace;` confirme RLS activée sur les 9 tables.
- [ ] Aucune policy `using (true)` sans restriction de rôle sur une table de données de terrain.
- [ ] Aucune colonne nom/téléphone/e-mail/identifiant sur `orientations` (grep du schéma en CI).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` absente de tout bundle client (vérification `next build` + grep du dossier `.next/static`).
- [ ] Tous les dashboards vérifiés pour le filtre `archived_at IS NULL`.
