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

## 3. Structure du projet

État réel après l'Étape 3 (les entrées marquées « à venir » restent planifiées telles quelles pour les étapes suivantes) :

```
proxy.ts                           # ex-middleware.ts (renommage Next.js 16) : session + gating
app/
  page.tsx                         # filet de sécurité, redirige toujours vers /login
  (auth)/
    login/
      page.tsx                     # wrapper serveur (lit ?error=)
      LoginForm.tsx                 # 2 étapes client : e-mail → code à 6 chiffres
    onboarding/
      page.tsx                     # charte + RGPD, bloque tant que non accepté
      OnboardingForm.tsx
      actions.ts                   # Server Action, valide et horodate côté serveur
  auth/
    signout/route.ts
  (mediator)/
    layout.tsx                     # + BottomNav (4 onglets)
    BottomNav.tsx
    accueil/page.tsx               # actions rapides + activité récente réelle
    activites/
      page.tsx                     # liste, état vide, filtre par date
      nouveau/
        page.tsx
        actions.ts                 # Server Action createActivity
      [id]/
        page.tsx                   # détail, bascule en édition via ?edit=1
        actions.ts                 # updateActivity, archiveActivity (soft delete)
        ArchiveButton.tsx
      ActivityForm.tsx             # partagé création/édition
      Stepper.tsx                  # bornes min/max — état invalide jamais atteignable depuis l'UI
      ChipSelect.tsx
    orientations/
      page.tsx                     # liste + carte lien EFS à partager (EfsLinkCard.tsx)
      nouveau/
        page.tsx                   # formulaire autonome, ?activity_id= optionnel pour lier une activité existante
        actions.ts                 # Server Action createOrientation (insert simple, RLS vérifie activity_id)
      OrientationForm.tsx
      RadioList.tsx                # sélection unique du statut de suivi (lignes, pas des chips)
      EfsLinkCard.tsx
    activites/PendingOrientations.tsx  # brouillons d'orientation en mémoire, ajoutés dans le flux "Nouvelle activité"
    freins/page.tsx                # placeholder, à venir Étape 5
  (coordinator)/
    layout.tsx
    dashboard/page.tsx             # placeholder, sections 0-4 à venir Étape 8
    mediateurs/
      nouveau/
        page.tsx                   # invitation (formulaire)
        actions.ts                 # Server Action service_role
      page.tsx                     # à venir Étape 9 : liste + fiche médiateur
  SignOutButton.tsx
  r/[slug]/route.ts                # redirection courte EFS publique, cf. §4bis
  api/
    health/route.ts
lib/
  supabase/
    client.ts                      # client navigateur (anon key, RLS)
    server.ts                      # client serveur (session utilisateur, RLS)
    admin.ts                       # client service_role, usage strictement serveur, jamais importé côté client
    middleware.ts                  # updateSession(), logique de gating utilisée par proxy.ts
  site-url.ts                      # URL publique du site pour les redirections e-mail
  config/
    options.ts                     # listes fixes non stockées en base (campus, type/durée/support d'activité)
  validation/
    activity.ts                    # schéma Zod partagé client/serveur, mêmes règles que les CHECK de la DB
  offline/                         # à venir Étape 6 : file IndexedDB + logique de sync
supabase/
  migrations/
    0001_init.sql
    0002_grants.sql                # restaure les privilèges Postgres perdus lors d'un incident de récupération
    0003_activity_with_orientations.sql  # RPC atomique création activité + orientations en une transaction
    0004_increment_link_click.sql  # RPC SECURITY DEFINER, incrément atomique du compteur de clics EFS
    0005_fix_function_grants.sql   # révoque anon/authenticated de deux fonctions que 0002 leur avait rouvertes par erreur
```

## 3bis. Listes fixes côté configuration (pas de table dédiée)

Deux listes sont volontairement gérées comme des constantes applicatives (`lib/config/options.ts`) plutôt que comme des tables Supabase, pour rester alignées avec le principe de minimalisme des 9 tables :

- **Campus/université** (champ `activities.campus`, texte libre en base) : liste suggérée à l'UI (Toulouse III – Paul Sabatier, Toulouse Capitole, Toulouse – Jean Jaurès, INSA Toulouse, Toulouse INP), modifiable sans migration si BOMOI ajoute un campus partenaire.
- **Support utilisé** (champ `activities.support_used`, texte libre en base) : liste verrouillée avec BOMOI — flyer, affiche, brochure, vidéo, carte-réponse, lien EFS, aucun, autre (chips + champ libre si « autre »).

## 4. Authentification et gestion des comptes

- Pas d'auto-inscription. Un admin ou coordinateur invite un médiateur (e-mail) depuis `mediateurs/nouveau`.
  - **E-mail inconnu** : Server Action → `supabase.auth.admin.inviteUserByEmail()` (clé service_role, côté serveur) → création des lignes `profiles` (role=`mediator`) et `mediators`.
  - **E-mail déjà associé à un compte existant** (typiquement un coordinateur/admin qui va aussi sur le terrain) : recherché via `listUsers()` côté service_role, aucun nouveau compte Auth créé, `profiles.role` jamais modifié — seule une ligne `mediators` est ajoutée à son compte existant. PRD §2.1. Rejeté explicitement si ce compte a déjà une fiche médiateur.
  - Le rôle (`profiles.role`, accès coordinateur/admin) et la capacité médiateur (présence d'une ligne `mediators`) sont donc deux attributs indépendants d'un même compte — jamais l'inverse : un `profiles.role = 'mediator'` n'obtient jamais l'accès coordinateur/admin, qui exige un changement de rôle explicite par un admin (`set_user_role`).
  - Le proxy (`lib/supabase/middleware.ts`) résout systématiquement les deux (rôle + présence d'une fiche médiateur) et route en conséquence ; un compte à double casquette peut basculer entre `/accueil` et `/dashboard` via un lien dans chaque interface.
- Connexion : **code à 6 chiffres saisi manuellement**, pas de lien cliquable. `LoginForm.tsx` (client) appelle `signInWithOtp({ email, options: { shouldCreateUser: false } })`, affiche un champ de saisie, puis `verifyOtp({ email, token, type: "email" })`. Un rechargement complet (`window.location.assign`) suit le succès pour que le proxy relise la session fraîchement établie.
  - **Pourquoi pas de lien** : première implémentation testée en conditions réelles avec un lien cliquable (`token_hash`/`verifyOtp` côté serveur). Échec systématique : de nombreux clients e-mail et antivirus (aperçus Gmail, Safe Links Outlook, scanners de sécurité) suivent automatiquement les liens contenus dans un e-mail pour les vérifier, avant le vrai clic de l'utilisateur. Les jetons Supabase étant à usage unique, ce pré-scan les consommait silencieusement — confirmé par les erreurs Supabase elles-mêmes (« otp expired », « One-time token not found ») quelques secondes après réception de l'e-mail, alors même qu'un palier intermédiaire avait déjà été ajouté pour ne consommer le jeton que sur clic explicite (POST). Un code recopié manuellement par l'utilisateur ne peut pas être consommé à sa place.
  - Modèles d'e-mail Supabase (Magic Link, Invite user) : doivent afficher `{{ .Token }}` en clair dans le corps (voir README.md « Authentification »).
- Première connexion → redirection forcée vers `/onboarding` tant que `mediators.charter_accepted_at` et `mediators.privacy_accepted_at` sont `NULL`. Le proxy (`proxy.ts`) vérifie cet état sur chaque route protégée.
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
- Génération du lien : RPC Postgres `SECURITY DEFINER` `get_or_create_efs_link(p_activity_id uuid default null)`, appelable par le médiateur authentifié uniquement pour lui-même (vérifie `auth.uid()` en interne). Génère un `slug` aléatoire (8 caractères) si aucun lien n'existe déjà pour ce couple médiateur/activité — idempotent, rappelable sans jamais créer de doublon. Affiché avec un bouton « Copier » sur `app/(mediator)/orientations/page.tsx` (`EfsLinkCard.tsx`) : un lien général (sans activité) toujours visible en haut de la liste, plus un lien par activité disponible depuis le détail de chaque activité.
- Redirection : `app/r/[slug]/route.ts`, Route Handler public (pas d'auth requise — ce sont les personnes sensibilisées, non authentifiées, qui cliquent). Ajouté à `PUBLIC_PATHS` dans `lib/supabase/middleware.ts` pour court-circuiter la vérification de session avant même la création du client Supabase — sans cette entrée, un visiteur anonyme cliquant le lien serait redirigé vers `/login` au lieu du site EFS (repéré et corrigé pendant la vérification de l'Étape 4). Utilise le client `service_role` côté serveur pour :
  1. incrémenter `click_count` de façon atomique via la RPC `SECURITY DEFINER` `increment_link_click(p_slug text)` (`UPDATE ... SET click_count = click_count + 1 WHERE slug = ... RETURNING true` en une seule requête — pas de lire-puis-écrire, pour ne perdre aucun clic en cas de clics concurrents) ; réservée au rôle `service_role` (`GRANT EXECUTE` explicite, `REVOKE` de `anon`/`authenticated` — voir migration 0005 ci-dessous) ;
  2. répondre `302` vers l'URL officielle EFS configurée (variable d'environnement `EFS_TARGET_URL`), que le `slug` ait été trouvé ou non — jamais d'erreur visible pour un visiteur externe, jamais d'indice sur l'existence ou non d'un lien.
- **Aucune IP stockée** : la route ne lit ni ne journalise aucun en-tête ou propriété de la requête (pas d'IP, pas de user-agent) — seul le compteur agrégé est incrémenté. Rate-limiting anti-bot par IP (fenêtre glissante en mémoire, ex. Vercel Edge Config/KV) documenté comme amélioration possible mais non implémenté en V1 : le risque accepté est un compteur légèrement gonflé par des clics automatisés, jamais une IP stockée.

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
