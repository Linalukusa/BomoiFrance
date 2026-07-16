# Plan de développement — BOMOI Mediation Hub V1

Chaque étape est petite, testable indépendamment, et laisse le projet dans un état fonctionnel (rien de « à moitié câblé »). Aucune étape ne commence avant validation de `PRODUCT_REQUIREMENTS.md`, `ARCHITECTURE.md`, `supabase/migrations/0001_init.sql` et `SECURITY.md`.

## Étape 0 — Validation (en cours)

- Revue par BOMOI des 4 documents + réponse aux points ouverts (`PRODUCT_REQUIREMENTS.md` §0).
- Décision sur les durées de conservation définitives (§6.3).

## Étape 1 — Socle projet

- Initialisation Next.js (App Router, TypeScript, Tailwind), lint/format (ESLint, Prettier).
- Configuration Tailwind avec les tokens de couleur/typographie du design system (§3 du PRD).
- Projet Supabase créé, application de `0001_init.sql`, vérification RLS (checklist `SECURITY.md` §9).
- Déploiement Vercel « hello world » connecté au repo, variables d'environnement configurées.
- **Critère de fin** : build qui déploie, connexion à Supabase vérifiée par une requête simple depuis une route de test.

## Étape 2 — Authentification et onboarding

- Écran de connexion (lien magique), page d'attente/callback.
- Flux d'invitation admin → création `profiles`/`mediators` (Route Handler service_role).
- Écran d'onboarding (charte + RGPD, deux cases horodatées), middleware de redirection tant que non complété.
- **Critère de fin** : un admin peut inviter un médiateur de test, qui se connecte, passe l'onboarding, arrive sur un écran d'accueil vide.

## Étape 3 — Formulaire « Nouvelle activité » (sans orientation intégrée)

- Layout mobile + navigation basse.
- Formulaire une page, steppers, chips, validations (bornes ≥0, conversations ≤ atteintes, intéressées ≤ atteintes).
- Enregistrement, jamais bloquant.
- Liste des activités (état vide inclus), écran de détail.
- **Critère de fin** : un médiateur de test crée, consulte, modifie et archive une activité.

## Étape 4 — Orientations

- Formulaire autonome « Nouvelle orientation ».
- Intégration dans le flux « Nouvelle activité » (compteur + bouton « + Ajouter une orientation »).
- Génération du lien court EFS (RPC) + page de profil/activité affichant le lien à partager.
- Route de redirection `/r/[slug]` avec incrément de compteur, testée sans authentification.
- **Critère de fin** : une orientation liée à une activité est visible dans le compteur ; un clic sur le lien court redirige et incrémente `click_count` sans écrire d'IP en base.

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
