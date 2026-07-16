# Architecture technique — BOMOI Mediation Hub

## 1. Vue d'ensemble

Un seul repo, un seul déploiement Vercel, une seule application Next.js (App Router, TypeScript). Le rôle stocké dans `profiles.role` détermine ce que l'utilisateur voit et peut faire — pas un sous-domaine, pas un build séparé.

```
Navigateur (mobile médiateur / desktop coordinateur)
        │  HTTPS
        ▼
   Next.js (Vercel) ── App Router, Server Components + Server Actions
        │  supabase-js (RLS appliquée systématiquement, jamais de bypass côté client)
        ▼
   Supabase (Postgres + Auth + Storage non utilisé en V1)
```

Aucun backend séparé. Les seules opérations privilégiées (invitation d'un médiateur, changement de rôle, incrément de compteur de clic EFS) passent par des **Next.js Route Handlers / Server Actions** utilisant la clé `service_role` côté serveur uniquement (jamais exposée au client), qui elles-mêmes appellent des fonctions Postgres `SECURITY DEFINER` restreintes.

## 2. Stack

- **Next.js 14+ (App Router, TypeScript)** — Server Components par défaut, Server Actions pour les mutations, layouts séparés `(mediator)` et `(coordinator)` sous un même groupe de routes authentifiées.
- **Tailwind CSS** — tokens de design (couleurs, rayons, espacements) déclarés dans `tailwind.config.ts` à partir de la palette extraite des maquettes (§3 du PRD).
- **Supabase** — Postgres (schéma `public`), Auth (lien magique / OTP e-mail, pas de mot de passe), RLS activée sur toutes les tables exposées.
- **next-pwa** (ou équivalent App Router) — manifeste + service worker pour l'installabilité et le cache des assets statiques.
- **IndexedDB (via `idb`)** — file d'attente locale des formulaires en mode hors-ligne.
- **Vercel** — hébergement, variables d'environnement, déploiements preview par PR.
- **Recharts** (ou équivalent léger) — graphiques simples du dashboard (courbe de progression, barres de répartition), cohérent avec le rendu sobre des maquettes.

## 3. Structure du projet (proposée)

```
app/
  (auth)/
    login/page.tsx                 # saisie e-mail, envoi du lien magique
    onboarding/page.tsx            # charte + RGPD, bloque tant que non accepté
  (mediator)/
    layout.tsx                     # layout mobile, nav basse (Accueil/Activité/Orientation/Freins)
    accueil/page.tsx
    activites/
      page.tsx                     # liste + état vide + badge "à compléter"
      nouveau/page.tsx             # formulaire une page, orientation intégrée
      [id]/page.tsx                # détail/édition + actions rapides
    orientations/
      page.tsx
      nouveau/page.tsx
      [id]/page.tsx
    freins/
      page.tsx
      nouveau/page.tsx
    statistiques/page.tsx          # "Mes statistiques"
    profil/page.tsx
  (coordinator)/
    layout.tsx                     # layout desktop/tablette
    dashboard/page.tsx             # sections 0 à 4
    mediateurs/
      page.tsx                     # liste + invitation
      [id]/page.tsx                # fiche, édition (hors rôle), historique
    collectes/
      page.tsx                     # CRUD aggregate_collection_results (admin only pour résultats)
    comptes/page.tsx               # gestion rôles — admin only
  r/[slug]/route.ts                # redirection courte EFS (302 + incrément compteur, service role)
  api/
    invite-mediator/route.ts       # admin/coordinator only, service role
    set-role/route.ts              # admin only, service role
lib/
  supabase/
    client.ts                      # client navigateur (anon key, RLS)
    server.ts                      # client serveur (session utilisateur, RLS)
    admin.ts                       # client service_role, usage strictement serveur, jamais importé côté client
  offline/
    queue.ts                       # file IndexedDB + logique de sync
  validation/
    activity.ts, orientation.ts, barrier.ts   # schémas Zod partagés client/serveur
supabase/
  migrations/
    0001_init.sql
```

## 4. Authentification et gestion des comptes

- Pas d'auto-inscription. Un admin ou coordinateur invite un médiateur (e-mail) depuis `mediateurs/page.tsx` → Server Action → `supabase.auth.admin.inviteUserByEmail()` (clé service_role, côté serveur) → création simultanée des lignes `profiles` (role=`mediator`) et `mediators` dans la même transaction applicative.
- Connexion : lien magique envoyé par Supabase Auth. Pas de mot de passe à gérer, pas de flux d'inscription libre.
- Première connexion → redirection forcée vers `/onboarding` tant que `mediators.charter_accepted_at` et `mediators.privacy_accepted_at` sont `NULL`. Un middleware Next.js vérifie cet état sur chaque route protégée.
- Changement de rôle : jamais via une simple mise à jour de table côté client. Passe exclusivement par la Server Action `set-role`, réservée à `admin`, qui appelle une fonction Postgres `SECURITY DEFINER` (voir `SECURITY.md`).

## 5. Support hors-ligne

Objectif : un médiateur sans réseau (sous-sol, hall universitaire) peut remplir un formulaire d'activité/orientation/frein et le voir se synchroniser dès que la connexion revient — sans perte, sans doublon.

- Détection : `navigator.onLine` + écouteurs `online`/`offline`, doublés d'un ping léger (les événements du navigateur seuls ne sont pas fiables à 100 %).
- Bandeau persistant « Hors ligne — sera synchronisé dès que possible » affiché en haut de l'écran dès que l'état hors-ligne est détecté.
- À la soumission d'un formulaire hors-ligne : écriture immédiate dans une table IndexedDB `pending_mutations` (payload + type d'entité + UUID généré côté client pour idempotence), confirmation visuelle instantanée à l'utilisateur (« Enregistré localement, sera envoyé automatiquement »).
- Au retour réseau (événement `online` + vérification effective de connectivité) : vidage de la file dans l'ordre FIFO, un appel Supabase par mutation, avec l'UUID généré côté client comme clé primaire (`INSERT ... ON CONFLICT DO NOTHING` côté serveur) pour garantir l'idempotence en cas de rejeu.
- Échec de sync (conflit de validation serveur, ex. incohérence détectée) : la mutation reste en file avec un statut « en erreur », visible et corrigeable manuellement par le médiateur — jamais silencieusement perdue.
- Limite assumée en V1 : pas de Background Sync API (support Safari/iOS incomplet) — la synchronisation se déclenche à l'ouverture de l'app et au retour réseau détecté pendant que l'app est ouverte, pas en arrière-plan total. À documenter clairement pour les médiateurs.

## 6. Module de tracking EFS (liens courts)

- Table unique `link_clicks` : un enregistrement par lien généré (par médiateur, éventuellement par activité), avec un compteur `click_count` et `last_clicked_at`.
- Génération du lien : RPC Postgres `SECURITY DEFINER` `get_or_create_efs_link(p_activity_id uuid default null)`, appelable par le médiateur authentifié uniquement pour lui-même (vérifie `auth.uid()` en interne). Génère un `slug` aléatoire (ex. 8 caractères base62) si aucun lien n'existe déjà pour ce couple médiateur/activité.
- Redirection : `app/r/[slug]/route.ts`, Route Handler public (pas d'auth requise — ce sont les personnes sensibilisées, non authentifiées, qui cliquent). Utilise le client `service_role` côté serveur pour :
  1. chercher `slug` dans `link_clicks` ;
  2. si trouvé, incrémenter `click_count` (requête atomique `UPDATE ... SET click_count = click_count + 1`) ;
  3. répondre `302` vers l'URL officielle EFS configurée (variable d'environnement `EFS_TARGET_URL`) ;
  4. si non trouvé, `302` vers l'URL EFS générique (jamais d'erreur visible pour un visiteur externe).
- **Aucune IP stockée** : un middleware Edge applique un rate-limit simple en mémoire (fenêtre glissante courte, ex. Vercel Edge Config ou KV à courte durée de vie) pour limiter les clics automatisés, sans persister l'IP en base. Passé la fenêtre anti-bot, l'IP n'existe plus nulle part dans le système.

## 7. Dashboard coordinateur/admin — calculs

Toutes les requêtes d'agrégation filtrent systématiquement `archived_at IS NULL`. Recommandation : exposer des **vues Postgres** dédiées (`v_dashboard_impact`, `v_dashboard_barriers`, `v_dashboard_campus`, `v_reliability`) qui encapsulent ce filtre une fois pour toutes plutôt que de le répéter dans chaque requête applicative — réduit le risque d'oubli et simplifie l'audit.

- « Freins les plus fréquents » : `COUNT(*)` sur `activity_barriers` non archivées, groupé par `barrier_id`, jamais `COUNT(DISTINCT activity_id)` — cohérent avec la règle de comptage par occurrence explicitée dans le PRD.
- « Répartition par campus » : `COUNT(*)` sur `activities` non archivées groupé par `campus`.
- Ratio orientations/intéressés, taux de rétention : calculés côté application à partir des agrégats bruts renvoyés par les vues (pas de division en SQL pour éviter les erreurs de division par zéro non gérées).

## 8. PWA

- `manifest.json` : nom « BOMOI Mediation Hub », icônes (dérivées du logo « B » sur fond `#171412` vu dans les maquettes), couleur de thème `#C81E3A`, `display: standalone`.
- Service worker : cache-first pour les assets statiques (JS/CSS/police), network-first pour les données Supabase (jamais de cache de données sensibles au-delà de la session).
- Installable sur mobile (médiateurs) comme sur desktop (coordinateurs peuvent aussi l'installer, mais l'usage principal reste le navigateur via lien direct).

## 9. Déploiement

- Un seul projet Vercel, un seul projet Supabase (avec environnements `staging`/`production` si budget le permet, sinon un seul environnement `production` avec branches Supabase pour les migrations testées avant application).
- Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement, jamais préfixée `NEXT_PUBLIC_`), `EFS_TARGET_URL`.
- Migrations Supabase versionnées dans `supabase/migrations/`, appliquées via `supabase db push` en CI avant chaque déploiement de production.

## 10. Ce que ce document ne couvre pas encore

Le détail des composants UI (props, variantes) et le plan de test seront affinés au moment de l'implémentation de chaque écran, en suivant fidèlement les maquettes. Aucune page ne sera codée avant validation de ce document, du schéma (`supabase/migrations/0001_init.sql`) et de `SECURITY.md`.
