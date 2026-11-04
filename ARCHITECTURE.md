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
   Supabase (Postgres + Auth + Storage non utilisé — médiathèque V2 en lien externe, jamais le fichier)
```

Aucun backend séparé. Les seules opérations privilégiées (invitation d'un médiateur, changement de rôle, incrément de compteur de clic EFS) passent par des **Next.js Route Handlers / Server Actions** utilisant la clé `service_role` côté serveur uniquement (jamais exposée au client), qui elles-mêmes appellent des fonctions Postgres `SECURITY DEFINER` restreintes.

## 2. Stack

- **Next.js 14+ (App Router, TypeScript)** — Server Components par défaut, Server Actions pour les mutations, layouts séparés `(mediator)` et `(coordinator)` sous un même groupe de routes authentifiées.
- **Tailwind CSS** — tokens de design (couleurs, rayons, espacements) déclarés dans `tailwind.config.ts` à partir de la palette extraite des maquettes (§3 du PRD).
- **Supabase** — Postgres (schéma `public`), Auth (lien magique / OTP e-mail, pas de mot de passe), RLS activée sur toutes les tables exposées.
- **next-pwa** (ou équivalent App Router) — manifeste + service worker pour l'installabilité et le cache des assets statiques.
- **IndexedDB (via `idb`)** — file d'attente locale des formulaires en mode hors-ligne.
- **Vercel** — hébergement, variables d'environnement, déploiements preview par PR.
- **Pas de librairie de graphiques externe** — `components/dashboard/{ProgressBar,MonthlyBarChart}.tsx` : divs proportionnels simples (barre de progression, barres mensuelles), suffisants pour les graphiques sobres des maquettes sans dépendance supplémentaire.

## 3. Structure du projet

État réel après l'Étape 15 (V2). Le détail de chaque écran V2 est documenté au fil de l'eau dans `DEVELOPMENT_PLAN.md` ; cet arbre donne la vue d'ensemble :

```
proxy.ts                           # ex-middleware.ts (renommage Next.js 16) : session + gating
app/
  page.tsx                         # filet de sécurité, redirige toujours vers /login
  (auth)/
    login/
      page.tsx
      LoginForm.tsx                 # 2 étapes client : e-mail → code à 6 chiffres
    onboarding/
      page.tsx                     # charte + RGPD (obligatoires) + consentement recherche (3e case, facultative, V2)
      OnboardingForm.tsx
      actions.ts
  auth/
    signout/route.ts
  (mediator)/
    layout.tsx                     # + BottomNav (3 onglets : Accueil / Actions / Mon parcours)
    BottomNav.tsx
    accueil/page.tsx               # sections "En cours" / "À compléter" / activité récente (cloturee uniquement)
    activites/
      page.tsx                     # liste (créateur ou participant), badge de statut
      nouveau/{page,actions,StartActivityForm}.tsx   # "Démarrer une action" (V2) : RPC start_activity
      [id]/
        page.tsx                   # détail, status-aware (en_cours → /terrain, boutons /cloture selon statut)
        actions.ts                 # archiveActivity (soft delete, créateur uniquement)
        [id]/terrain/{page,TerrainCounters,actions}.tsx   # compteurs +/- auto-save, freins par occurrence
        [id]/cloture/{page,ClotureForm,actions}.tsx       # contexte/supports/idées reçues, auto-save champ par champ
      Stepper.tsx                  # bornes min/max, 44px minimum
      ChipSelect.tsx
      EfsLinkCard.tsx
    parcours/{page,actions}.tsx    # dates d'engagement, heures cumulées, consentement recherche révocable, attestation (lecture)
    statistiques/page.tsx          # "Mes statistiques" (indicateurs d'impact personnels, PRD §4.7) — plus dans la nav basse, lien depuis /parcours
  (coordinator)/
    layout.tsx
    dashboard/page.tsx             # 5 sections (Objectifs → Fiabilité) + rangée de liens vers les écrans ci-dessous
    mediateurs/
      nouveau/{page,actions}.tsx   # invitation (service_role)
      page.tsx
      StatusBadge.tsx
      [id]/
        page.tsx                   # fiche : édition hors rôle + dates de parcours + bloc recherche/attestation (lecture) + (admin) rôle/suppression
        actions.ts
        MediatorForm.tsx
        RoleSelector.tsx / DeleteAccountButton.tsx   # admin uniquement
        attestation/{page,actions,PrintButton}.tsx   # imprimable, coordinateur/admin uniquement — jamais le médiateur
    medias/{page,actions}.tsx      # médiathèque (traçabilité photo/vidéo, jamais le fichier)
    observations/{page,actions}.tsx # notes qualitatives internes, jamais visibles par le médiateur observé
    sessions/{page,actions,[id]/page}.tsx  # formations + présence (remplace entièrement la liste à chaque sauvegarde)
    collectes/{page,actions,[id]/page}.tsx # résultats officiels EFS, saisie admin uniquement
    reglages/{page,actions}.tsx    # admin : bascule recherche, export CSV, anonymisation des comptes inactifs
  changements/{page,actions}.tsx   # SEULE page hors des deux groupes ci-dessus — lue par tous, écrite par coordinateur/admin (cf. §4ter)
  SignOutButton.tsx
  r/[slug]/route.ts                # redirection courte EFS publique, cf. §6
  api/
    health/route.ts
    export/[dataset]/route.ts      # CSV pseudonymisé, admin uniquement, cf. §4quater
components/
  dashboard/{StatCard,ProgressBar,MonthlyBarChart,InfoTooltip}.tsx
  forms/{SubmitButton,SuccessBanner,ChipMultiSelect}.tsx
lib/
  supabase/{client,server,admin,middleware}.ts
  site-url.ts
  config/{options,definitions,objectives}.ts   # options.ts porte aussi CATEGORY_VERSION (V2)
  dashboard/months.ts
  validation/{activity,orientation,barrier,mediator}.ts
  offline/                         # à venir Étape 17 (PWA) — pas démarré
supabase/
  migrations/
    0001_init.sql … 0006_dashboard_views.sql      # V1, cf. historique git pour le détail
    0007_v2_activity_flow.sql       # statuts, activity_participants, activity_misconceptions, RPC démarrer/compter/terminer/clôturer
    0008_peer_mediator_picker.sql   # list_active_mediators() — élévation de privilège contrôlée (SECURITY.md §3)
    0009_misconceptions_participant_rls.sql
    0010_mediator_journey.sql       # app_settings, dates de parcours, consentement recherche, sessions, v_mediator_hours
    0011_coordinator_tools.sql      # media_log, field_observations, tool_changelog
    0012_usage_metrics.sql          # v_usage_metrics (adoption de l'outil, jamais la performance de médiation)
    0013_retention.sql              # purge_inactive_mediators()
```

## 3bis. Listes fixes côté configuration (pas de table dédiée)

Plusieurs listes sont volontairement gérées comme des constantes applicatives (`lib/config/options.ts`) plutôt que comme des tables Supabase, pour rester alignées avec le principe de minimalisme déjà appliqué en V1 — chacune synchronisée avec la contrainte `CHECK` correspondante :

- **Campus/université** (champ `activities.campus`, texte libre en base) : liste suggérée à l'UI (Toulouse III – Paul Sabatier, Toulouse Capitole, Toulouse – Jean Jaurès, INSA Toulouse, Toulouse INP), modifiable sans migration si BOMOI ajoute un campus partenaire.
- **Support utilisé** (`activities.supports_used`, tableau en base depuis la V2) : liste verrouillée avec BOMOI — flyer, affiche, brochure, vidéo, carte-réponse, lien EFS, aucun, autre (chips multi-sélection + champ libre si « autre »).
- **Période / public / contexte événementiel** (V2, écran de clôture) : `PERIOD_OPTIONS`/`AUDIENCE_OPTIONS`/`EVENT_CONTEXT_OPTIONS`, synchronisées avec les contraintes `CHECK` de `activities.period`/`audience`/`event_context` (`0007_v2_activity_flow.sql`).
- `CATEGORY_VERSION` (V2) : pas une liste mais la version courante de l'ensemble de ces listes, enregistrée sur chaque nouvelle ligne catégorisée (`activities.category_version`, `activity_barriers.category_version`) pour rester interprétable si une future révision change le sens des valeurs déjà enregistrées.

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

## 4bis. Flux d'action partagée (V2)

- Trois statuts (`activities.status` : `en_cours` → `a_completer` → `cloturee`) portés par trois RPC `SECURITY INVOKER` (`start_activity`, `end_activity`, `close_activity`, `supabase/migrations/0007_v2_activity_flow.sql`) plutôt que par des `UPDATE` directs — chacune ne touche que les colonnes pertinentes à la transition, jamais un champ arbitraire fourni par le client.
- Partage entre médiateurs : table `activity_participants` (le créateur y est inséré automatiquement par `start_activity`). Un co-participant peut compter/clôturer la même action sans la dupliquer ; chacun est crédité en entier des heures de l'action (`v_mediator_hours`), jamais une division proportionnelle. `guard_activity_update` (trigger) empêche la réassignation du créateur et réserve l'archivage au créateur — RLS seule ne peut pas comparer `OLD`/`NEW` sur une colonne différente de celle filtrée par la condition.
- Écran terrain (`TerrainCounters.tsx`) : chaque tap appelle directement une Server Action (`increment_activity_counter`/`increment_barrier`, pas de `<form>`) avec mise à jour optimiste côté client puis réconciliation sur les valeurs autoritaires renvoyées par la RPC ; file de réessai en mémoire en cas d'échec réseau — jamais un tap perdu silencieusement. Les freins comptent désormais par occurrence (`activity_barriers.occurrences`), plus par simple présence/absence.
- Écran de clôture (`ClotureForm.tsx`) : sauvegarde automatique champ par champ (`updateActivityField`, allowlist fermée de colonnes), jamais de bouton « Enregistrer » avant le bouton final de clôture — ne bloque jamais sur un champ facultatif vide.
- Chaque donnée catégorisée porte `category_version` (constante `CATEGORY_VERSION` dans `lib/config/options.ts`) pour rester interprétable si les listes fermées changent de sens dans une future version.

## 4ter. Parcours médiateur et outils coordinateur (V2)

- `mediators` porte depuis `0010_mediator_journey.sql` les dates d'engagement, le consentement recherche révocable et le statut d'attestation. `guard_mediator_journey_fields` (trigger) impose, colonne par colonne, qui peut écrire quoi : le consentement recherche uniquement par le médiateur lui-même (jamais un coordinateur — un consentement donné par un tiers serait invalide), l'attestation et les dates d'engagement uniquement par coordinateur/admin (jamais le médiateur, qui ne peut sinon s'auto-délivrer une attestation) — même angle mort RLS que `guard_activity_update` ci-dessus.
- `app_settings` (ligne unique) + fonction `is_research_collection_enabled()` : un médiateur doit savoir si la collecte de recherche est active sans jamais avoir d'accès en lecture à la table elle-même (4e élévation de privilège contrôlée, `SECURITY.md` §3).
- Outils coordinateur (`media_log`, `field_observations`, `tool_changelog`, `sessions`/`session_attendance`, écran de gestion des collectes EFS) : tables indépendantes, RLS coordinateur/admin sauf `tool_changelog` et `sessions` (catalogues sans donnée personnelle, lisibles par tout authentifié).
- **`app/changements/page.tsx` est la seule page du projet placée hors des deux groupes `(mediator)`/`(coordinator)`** : `tool_changelog` doit être lisible par un médiateur (transparence sur l'évolution de l'outil) mais écrit seulement par coordinateur/admin — aucun des deux groupes de routes, chacun réservé par le proxy à un seul camp, ne pouvait porter cette double exigence. La page fait elle-même la distinction lecture/écriture selon le rôle.

## 4quater. Export de recherche pseudonymisé (V2)

- `app/api/export/[dataset]/route.ts` (dataset `usage` pour l'instant) : admin uniquement, vérifié dans la route elle-même (pas seulement par le proxy, qui ne restreint pas `/api/export/*`). Combine la vue `v_usage_metrics` (adoption de l'outil — fréquence d'usage des écrans, jamais la performance de médiation, `0012_usage_metrics.sql`) et `v_mediator_hours`.
- Jamais `mediator_id` ni nom dans la sortie : remplacés par `mediators.research_code` (pseudonyme opaque, immuable une fois généré). Filtre explicite sur le consentement recherche actif, appliqué côté application après la lecture (pas seulement déduit d'`app_settings.research_collection_enabled`) — un médiateur non consentant n'apparaît jamais dans l'export, même si ses métriques existent et restent visibles par l'admin dans l'application elle-même.

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
- Génération du lien : RPC Postgres `SECURITY DEFINER` `get_or_create_efs_link(p_activity_id uuid default null)`, appelable par le médiateur authentifié uniquement pour lui-même (vérifie `auth.uid()` en interne). Génère un `slug` aléatoire (8 caractères) si aucun lien n'existe déjà pour ce couple médiateur/activité — idempotent, rappelable sans jamais créer de doublon. Affiché avec un bouton « Copier » en haut de `app/(mediator)/activites/page.tsx` (`EfsLinkCard.tsx`) : un lien général (sans activité), toujours visible au-dessus de la liste — pas d'écran dédié Orientation (retiré, voir PRD §0 point 7).
- Redirection : `app/r/[slug]/route.ts`, Route Handler public (pas d'auth requise — ce sont les personnes sensibilisées, non authentifiées, qui cliquent). Ajouté à `PUBLIC_PATHS` dans `lib/supabase/middleware.ts` pour court-circuiter la vérification de session avant même la création du client Supabase — sans cette entrée, un visiteur anonyme cliquant le lien serait redirigé vers `/login` au lieu du site EFS (repéré et corrigé pendant la vérification de l'Étape 4). Utilise le client `service_role` côté serveur pour :
  1. incrémenter `click_count` de façon atomique via la RPC `SECURITY DEFINER` `increment_link_click(p_slug text)` (`UPDATE ... SET click_count = click_count + 1 WHERE slug = ... RETURNING true` en une seule requête — pas de lire-puis-écrire, pour ne perdre aucun clic en cas de clics concurrents) ; réservée au rôle `service_role` (`GRANT EXECUTE` explicite, `REVOKE` de `anon`/`authenticated` — voir migration 0005 ci-dessous) ;
  2. répondre `302` vers l'URL officielle EFS configurée (variable d'environnement `EFS_TARGET_URL`), que le `slug` ait été trouvé ou non — jamais d'erreur visible pour un visiteur externe, jamais d'indice sur l'existence ou non d'un lien.
- **Aucune IP stockée** : la route ne lit ni ne journalise aucun en-tête ou propriété de la requête (pas d'IP, pas de user-agent) — seul le compteur agrégé est incrémenté. Rate-limiting anti-bot par IP (fenêtre glissante en mémoire, ex. Vercel Edge Config/KV) documenté comme amélioration possible mais non implémenté en V1 : le risque accepté est un compteur légèrement gonflé par des clics automatisés, jamais une IP stockée.

## 7. Dashboard coordinateur/admin — calculs

Toutes les requêtes d'agrégation filtrent systématiquement `archived_at IS NULL`. Exposé via 4 **vues Postgres** dédiées (`v_dashboard_impact`, `v_dashboard_barriers`, `v_dashboard_campus`, `v_reliability`, `supabase/migrations/0006_dashboard_views.sql`) qui encapsulent ce filtre une fois pour toutes plutôt que de le répéter dans chaque requête applicative — réduit le risque d'oubli et simplifie l'audit. Mises à jour en V2 (`0007_v2_activity_flow.sql`) pour exclure aussi les actions `en_cours` (chiffres partiels tant qu'une action n'est pas terminée) et pour compter les orientations V1 (table `orientations`) et V2 (`activities.orientations_in_person`/`orientations_remote`) sans double emploi.

> **Écart connu, non corrigé** : `app/(coordinator)/dashboard/page.tsx` (courbe de progression mensuelle) et `app/(mediator)/statistiques/page.tsx` interrogent directement `activities` sans filtrer `status <> 'en_cours'`, contrairement aux vues `v_dashboard_*` ci-dessus — repéré à l'Étape 11, toujours pas traité (hors périmètre de chaque étape concernée jusqu'ici). Une action en cours avec des chiffres partiels peut donc apparaître dans ces deux courbes avant d'être terminée.

- « Freins les plus fréquents » : `COUNT(*)` sur `activity_barriers` non archivées, groupé par `barrier_id`, jamais `COUNT(DISTINCT activity_id)` — cohérent avec la règle de comptage par occurrence explicitée dans le PRD.
- « Répartition par campus » : `COUNT(*)` sur `activities` non archivées groupé par `campus`.
- « Médiateurs formés » : `status IN ('forme', 'actif')` (un médiateur actif reste compté comme formé, il a nécessairement franchi cette étape) ; « actifs » : `status = 'actif'` strictement.
- Ratio orientations/intéressés, taux de rétention (actifs / recrutés) : calculés côté application à partir des agrégats bruts renvoyés par les vues (pas de division en SQL pour éviter les erreurs de division par zéro non gérées).
- **`security_invoker = true` obligatoire sur les 4 vues** : par défaut, une vue Postgres s'exécute avec les droits de son propriétaire (`postgres`, qui contourne RLS comme tout superutilisateur) — n'importe quel rôle `authenticated`, y compris un simple médiateur, obtiendrait alors l'agrégat de **tout le programme** en interrogeant directement la vue via l'API REST, ce que le PRD interdit explicitement (§2 : un médiateur « ne peut jamais voir une vue agrégée du programme »). Avec `security_invoker`, les policies RLS des tables sous-jacentes s'appliquent au rôle appelant réel : un médiateur qui interrogerait la vue directement ne verrait que ses propres lignes agrégées, jamais celles des autres. La page `/dashboard` reste de toute façon inaccessible à un médiateur seul via le proxy — cette protection est une deuxième ligne de défense en cas d'appel direct à l'API, sur le même principe que la correction de la migration 0005 pour les fonctions (les `alter default privileges` de `0002_grants.sql` rouvrent l'accès à `anon`/`authenticated` sur toute relation créée ensuite, y compris les vues — `revoke` explicite requis à chaque fois).

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

## 11. Rétention et purge (V2, Étape 16)

Détail complet dans `SECURITY.md` §6 et les durées dans `PRODUCT_REQUIREMENTS.md` §6.3 — résumé technique :

- Seule opération implémentée : `purge_inactive_mediators()` (`0013_retention.sql`), anonymise un compte médiateur inactif depuis plus de 12 mois (`mediators.left_at`). `SECURITY DEFINER`, revérifie `is_admin()` en interne, déclenchable manuellement depuis `/reglages` (jamais planifiée). Pose `mediators.anonymized_at` ; ne touche jamais `research_code` (pseudonyme opaque, pas une donnée identifiante) ni les lignes `activities`/`orientations` déjà liées (déjà anonymes par construction).
- La purge des données de terrain après « durée du programme + 3 ans » reste à écrire — bloquée sur une date de fin de programme que BOMOI n'a pas encore communiquée.
