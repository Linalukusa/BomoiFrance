# Plan de développement — BOMOI Mediation Hub V1

Chaque étape est petite, testable indépendamment, et laisse le projet dans un état fonctionnel (rien de « à moitié câblé »). Aucune étape ne commence avant validation de `PRODUCT_REQUIREMENTS.md`, `ARCHITECTURE.md`, `supabase/migrations/0001_init.sql` et `SECURITY.md`.

## Étape 0 — Validation

- [x] Revue par BOMOI des 4 documents + réponse aux points ouverts (`PRODUCT_REQUIREMENTS.md` §0) — validé le 16/07/2026.
- [ ] Décision sur les durées de conservation définitives (§6.3) — toujours ouvert, n'empêche pas de démarrer le développement (le code est structuré pour permettre une purge par date dès que les durées seront confirmées).

## Étape 1 — Socle projet ✅ validée

- [x] Initialisation Next.js (App Router, TypeScript, Tailwind), lint/format (ESLint, Prettier).
- [x] Configuration Tailwind avec les tokens de couleur/typographie du design system (§3 du PRD).
- [x] Projet Supabase créé, application de `0001_init.sql`, vérification RLS (checklist `SECURITY.md` §9).
- [x] Déploiement Vercel connecté au repo, variables d'environnement configurées.
- **Critère de fin** : build qui déploie, connexion à Supabase vérifiée par une requête simple depuis une route de test — validé le 16/07/2026 sur https://bomoi-mediation-hub.vercel.app/, `/api/health` renvoie `{"ok":true,"barriersSeeded":11}`.

## Étape 2 — Authentification et onboarding

- [x] Écran de connexion — `app/(auth)/login` (code à 6 chiffres saisi manuellement, pas de lien cliquable — un lien magique a été testé en premier puis abandonné, systématiquement consommé par le pré-scan automatique des liens de certaines messageries/antivirus avant le clic réel de l'utilisateur).
- [x] Flux d'invitation admin/coordinateur → création `profiles`/`mediators` — `app/(coordinator)/mediateurs/nouveau` (Server Action, `service_role`).
- [x] Écran d'onboarding (charte + RGPD, deux cases horodatées) — `app/(auth)/onboarding`.
- [x] Proxy (`proxy.ts`, ex-middleware) : session obligatoire, redirection `/onboarding` tant que non complété, séparation zones médiateur/coordinateur.
- [x] Écrans d'atterrissage minimaux — `app/(mediator)/accueil`, `app/(coordinator)/dashboard`.
- **Critère de fin** : un admin peut inviter un médiateur de test, qui se connecte, passe l'onboarding, arrive sur un écran d'accueil vide — validé le 17/07/2026 en conditions réelles (connexion par code, invitation fonctionnelle).

## Étape 3 — Formulaire « Nouvelle activité » (sans orientation intégrée) ✅ validée

- [x] Layout mobile + navigation basse (4 onglets Accueil/Activité/Orientation/Freins ; Orientation et Freins pointent vers des placeholders honnêtes en attendant les Étapes 4-5).
- [x] Formulaire une page, steppers, chips, validations (bornes ≥0, conversations ≤ atteintes, intéressées ≤ atteintes) — `app/(mediator)/activites/{ActivityForm,Stepper,ChipSelect}.tsx`. Les bornes sont appliquées directement sur les boutons +/− : un état invalide n'est jamais atteignable depuis l'UI, la validation Zod serveur (`lib/validation/activity.ts`) n'est qu'un filet de sécurité.
- [x] Enregistrement, jamais bloquant.
- [x] Liste des activités (état vide inclus, filtre simple par date) — `app/(mediator)/activites/page.tsx`.
- [x] Écran de détail/édition/archivage — `app/(mediator)/activites/[id]/page.tsx`.
- [x] Accueil médiateur enrichi avec activité récente réelle, reprenant l'état vide du mockup.
- **Critère de fin** : un médiateur de test crée, consulte, modifie et archive une activité. **Vérifié** : schéma de données/RLS/contraintes CHECK testés de bout en bout sur Postgres 16 local (isolation entre médiateurs, blocage des valeurs invalides, archivage vs suppression définitive, journal d'audit) ; formulaire vérifié visuellement et interactivement (clamp des steppers) via Playwright. **Écrans de liste/détail à confirmer en conditions réelles** (nécessitent une session authentifiée réelle, non testables en local sans projet Supabase).

## Étape 4 — Orientations ✅ validée

- [x] Formulaire autonome « Nouvelle orientation » — `app/(mediator)/orientations/nouveau/{page,actions}.tsx`, `OrientationForm.tsx`, `RadioList.tsx` ; validation Zod (`lib/validation/orientation.ts`) alignée sur les contraintes CHECK.
- [x] Intégration dans le flux « Nouvelle activité » (compteur + bouton « + Ajouter une orientation », brouillons en mémoire jusqu'à l'enregistrement final) — `ActivityForm.tsx` + `PendingOrientations.tsx` ; envoyées avec l'activité en une seule transaction via la RPC `create_activity_with_orientations` (`supabase/migrations/0003_activity_with_orientations.sql`) pour éviter toute activité orpheline. Le détail d'activité affiche en plus le nombre réel d'orientations liées, avec un lien pour en ajouter après coup.
- [x] Génération du lien court EFS (RPC `get_or_create_efs_link`, déjà présente dans `0001_init.sql`) + page « Mes orientations » affichant le lien à partager (`app/(mediator)/orientations/page.tsx`, `EfsLinkCard.tsx`).
- [x] Route de redirection `app/r/[slug]/route.ts` : client `service_role`, incrément atomique de `click_count` via la RPC SECURITY DEFINER `increment_link_click` (`supabase/migrations/0004_increment_link_click.sql`), aucune IP ni autre identifiant de requête lu ou stocké. Ajoutée à `PUBLIC_PATHS` du proxy pour rester accessible sans session.
- **Critère de fin** : une orientation liée à une activité est visible dans le compteur ; un clic sur le lien court redirige et incrémente `click_count` sans écrire d'IP en base. **Vérifié** : RPC/RLS/grants testés de bout en bout sur Postgres 16 local (transaction atomique avec rollback sur statut invalide, isolation entre médiateurs sur les orientations, lecture libre mais écriture admin-only sur les collectes, idempotence du lien EFS général vs lien par activité, aucune colonne d'IP dans le schéma). Deux écarts trouvés et corrigés pendant cette vérification :
  - `/r/[slug]` était absent de `PUBLIC_PATHS` du proxy : un visiteur anonyme cliquant le lien EFS aurait été redirigé vers `/login` au lieu du site EFS.
  - `anon` pouvait exécuter `create_activity_with_orientations` et `increment_link_click` directement via PostgREST : les `alter default privileges` de `0002_grants.sql` accordent EXECUTE à `anon`/`authenticated` sur toute fonction créée ensuite, et `revoke all ... from public` ne retire pas un droit accordé nommément — corrigé par des `revoke` explicites sur les rôles concernés (`supabase/migrations/0005_fix_function_grants.sql`).
  **Écrans à confirmer en conditions réelles** (nécessitent une session authentifiée réelle et l'URL publique de déploiement, non testables en local sans projet Supabase).

## Étape 5 — Journal des freins

- Formulaire multi-select (11 + Autre), liaison `activity_barriers`.
- Liste des freins déjà enregistrés.
- Badge « à compléter » sur les cartes d'activité (personnes intéressées sans orientation, ou aucun frein renseigné) + actions rapides sur l'écran de détail.
- **Critère de fin** : un médiateur voit le badge apparaître/disparaître selon l'état réel de ses données.

## Étape 6 — Mode hors-ligne

- File IndexedDB, bandeau d'état, synchronisation automatique au retour réseau.
- Tests manuels : coupure réseau pendant la saisie des 3 formulaires (activité, orientation, frein), vérification qu'aucune donnée n'est perdue et qu'il n'y a pas de doublon après sync.
- **Critère de fin** : scénario « avion en mode avion pendant la saisie, retour réseau 2 minutes après » validé sur mobile réel.

## Étape 7 — Tableau de bord médiateur

- « Mes statistiques » : cartes, freins les plus fréquents (données propres), courbe de progression mensuelle.
- **Critère de fin** : les chiffres affichés correspondent exactement aux données saisies par ce médiateur, aucune fuite vers d'autres médiateurs (testé avec 2 comptes de test).

## Étape 8 — Tableau de bord coordinateur/admin

- Layout desktop/tablette.
- Section 0 (objectifs vs réalisé) → Section 4 (fiabilité), dans l'ordre du PRD, avec infobulles reprenant les définitions verrouillées.
- Vues Postgres d'agrégation (`v_dashboard_*`) filtrant `archived_at IS NULL`.
- **Critère de fin** : les 5 sections affichent des données cohérentes avec un jeu de données de test multi-médiateurs ; vérification visuelle que la section « Fiabilité des données » est clairement séparée des indicateurs d'impact.

## Étape 9 — Gestion des médiateurs et des comptes (coordinateur/admin)

- Liste/fiche médiateur, édition (hors rôle), invitation.
- Écran admin de gestion des rôles (`set_user_role`), suppression définitive avec double confirmation.
- Écran admin de gestion des collectes (`aggregate_collection_results`) : création à l'avance, saisie des résultats après coup.
- **Critère de fin** : un admin change le rôle d'un compte de test, l'action apparaît dans `audit_logs` ; un coordinateur tente la même action et est bloqué.

## Étape 10 — PWA et finitions

- Manifest, service worker, test d'installation sur mobile (Android/iOS) et desktop.
- Vérification contrastes/tailles tactiles sur les écrans réels.
- Relecture complète des textes RGPD/charte affichés (fidélité au texte verrouillé).
- Checklist `SECURITY.md` §9 exécutée intégralement.
- **Critère de fin** : PWA installable, testée par au moins un médiateur BOMOI en conditions réelles avant mise en production.

## Étape 11 — Recette avec BOMOI/EFS

- Session de démonstration du dashboard coordinateur (Section 0 en premier, comme demandé pour un lecteur externe EFS/financeur).
- Ajustements mineurs de libellés/priorités selon retours.
- Mise en production.

---

Chaque étape peut faire l'objet d'une PR séparée et d'une revue avant de passer à la suivante. Aucune fonctionnalité hors du périmètre listé dans `PRODUCT_REQUIREMENTS.md` §1 ne sera ajoutée sans validation explicite préalable.
