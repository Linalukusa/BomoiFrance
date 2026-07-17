# BOMOI Mediation Hub — Cahier des charges produit (V1)

Statut : **validé par BOMOI le 16/07/2026**. Le développement peut démarrer sur la base de ce document, de l'architecture, du schéma de données et des politiques de sécurité.

## 0. Décisions de validation

Les points ouverts soumis à BOMOI ont été tranchés comme suit :

1. Compteur d'orientations sur le formulaire d'activité : **calculé** à partir des orientations réellement créées et liées à l'activité (pas de champ manuel redondant).
2. Statuts de suivi d'une orientation : **4 statuts**, pas de « Rendez-vous déclaré » — un médiateur ne peut pas confirmer qu'un rendez-vous a réellement été pris, ce serait une déclaration non vérifiable. Point à rediscuter en V2 avec l'EFS si une granularité supplémentaire s'avère utile.
3. Champ « individuel ou groupe » sur l'activité : **supprimé**, redondant avec le type d'activité qui porte déjà cette information.
4. Champ « support utilisé » : **conservé**, avec une liste de suggestions verrouillée : flyer, affiche, brochure, vidéo, carte-réponse, lien EFS, aucun, autre.
5. « Collecte concernée » sur l'orientation : **nullable**, référence `aggregate_collection_results` — confirmé tel quel.
6. Formulaire « Nouvelle orientation » en autonome (§4.3, onglet dédié) : **retiré** après implémentation — une orientation ne se crée plus qu'intégrée au flux « Nouvelle activité » (§4.2). L'onglet « Orientation » de la navigation basse reste une liste de consultation (+ lien EFS à partager), pas un point d'entrée de création.

## 1. Contexte et objectifs

BOMOI (association loi 1901, Montpellier) mène avec l'EFS Occitanie un projet pilote de médiation par les pairs auprès des étudiants de l'Université Toulouse – Jean Jaurès (UT2J) et des campus toulousains partenaires. Dix médiateurs bénévoles :

- sensibilisent des étudiants au don de sang (conversations, ateliers, stands, réseaux sociaux…) ;
- documentent anonymement les freins rencontrés ;
- orientent les personnes intéressées vers les parcours officiels EFS ;
- participent à deux collectes.

**Objectifs déclarés au PIEED** : 500 étudiants sensibilisés, 60 à 80 nouveaux donneurs.

BOMOI Mediation Hub est l'outil numérique support de ce pilote : saisie de terrain pour les médiateurs, pilotage et reporting pour la coordination BOMOI/EFS.

### Ce que la V1 n'est pas

Pour éviter toute dérive de périmètre, la V1 exclut explicitement (sauf validation ultérieure) :

- toute fonctionnalité de rappel ou de contact direct d'une personne sensibilisée/orientée ;
- toute donnée médicale, d'éligibilité au don ou d'origine ethnique ;
- la gamification, les classements ou comparaisons entre médiateurs ;
- un wizard multi-étapes pour le formulaire d'activité (une seule page scrollable) ;
- une application native ou un déploiement séparé pour les coordinateurs/admins (même PWA, même repo, même déploiement Vercel) ;
- la déclaration d'un « don réalisé » par un médiateur ;
- toute fonctionnalité non listée dans ce document, même si elle semble utile — elle sera proposée à BOMOI et l'EFS pour une V2 après retour d'usage.

## 2. Rôles et permissions

| Rôle | Peut lire | Peut écrire | Ne peut jamais |
|---|---|---|---|
| **mediator** | Ses propres données uniquement (profil, activités, orientations, freins, ses statistiques, son lien EFS) | Crée/modifie/archive (soft delete) ses propres activités, orientations, freins | Voir les données d'un autre médiateur, voir une vue agrégée du programme, modifier son rôle, supprimer définitivement, déclarer un don réalisé |
| **coordinator** | Données individuelles et agrégées de tous les médiateurs, dashboard complet | Gère les fiches médiateurs (statut, disponibilité, université…), met à jour son propre profil | Modifier un rôle, supprimer définitivement une entrée, saisir les résultats officiels de collecte |
| **admin** | Tout | Tout, y compris rôles, résultats officiels de collecte, suppression définitive | — |

La distinction se fait uniquement par la colonne `profiles.role`, contrôlée par Row Level Security. Une seule authentification, un seul déploiement — l'interface s'adapte simplement selon le rôle connecté (layout mobile pour `mediator`, layout desktop/tablette pour `coordinator`/`admin`).

### 2.1 Double casquette coordinateur/admin + médiateur

Un coordinateur ou un admin qui va aussi sur le terrain n'a pas besoin d'un second compte : la même adresse e-mail peut porter à la fois son rôle principal (`profiles.role`) et une fiche médiateur (ligne dans `mediators`), les deux étant indépendantes. Un tel compte peut basculer librement entre la vue médiateur et la vue coordinateur/admin (lien de bascule dans chaque interface), avec la charte + le RGPD à accepter séparément pour la partie médiateur avant de créer des activités.

**Dans l'autre sens, ce n'est jamais possible** : un compte dont le rôle est `mediator` ne peut jamais accéder à la zone coordinateur/admin, quelle que soit la situation. Un médiateur qui devient plus tard coordinateur nécessite un changement explicite de `profiles.role` par un admin (`set_user_role`), pas une simple fiche supplémentaire.

## 3. Système de design (référence : maquettes Claude Design)

Les maquettes font foi pour la structure des écrans, les composants et la mise en page. Tokens extraits :

**Couleurs**
- Accent principal (BOMOI) : `#C81E3A` (rouge)
- Encre / fond sombre (top bar, cartes de mise en avant, CTA secondaire) : `#171412`
- Fond de page hors carte : `#EDEAE8` / cartes : `#FFFFFF` / `#F6F4F3`
- Textes et bordures : `#4A4542` (texte secondaire foncé), `#6B6462` (texte muet), `#9C9490` (placeholder), `#D9D5D3` / `#DDD8D5` / `#E4DFDC` (bordures/dividers)
- États d'erreur (mode sombre observé dans les maquettes) : fond `#2a1215`, texte `#ff8a80`, bordure `#5c2b2e`

**Typographie** : police système (`-apple-system, BlinkMacSystemFont, sans-serif`), titres en gras, libellés de section en petites majuscules espacées (ex. « SECTION 1 · INDICATEURS D'IMPACT »).

**Composants réutilisables**
- Bouton primaire : pilule rouge pleine largeur, texte blanc gras
- Bouton secondaire/CTA sombre : pilule `#171412`, texte blanc (ex. « Créer ma première activité »)
- Champs texte/select/date : fond blanc, bordure fine grise, coins arrondis ~8px
- Puces (chips) à sélection unique ou multiple : bordure grise non sélectionnée → fond rouge/texte blanc sélectionnée, forme pilule
- Stepper numérique : bouton rond gris « − », valeur en gras au centre, bouton rond rouge « + » — **jamais de clavier natif**
- Carte de mise en avant (une métrique clé par écran) : fond `#171412`, texte blanc
- État vide : carte à bordure pointillée, texte gris centré + CTA sombre
- Navigation basse (mobile, rôle médiateur) : 4 icônes + libellé (Accueil / Activité / Orientation / Freins), icône+texte actifs en rouge
- Barres de progression (freins les plus fréquents) : barre rouge fine sur piste grise + pourcentage aligné à droite, avec infobulle de méthode de calcul
- Section « Fiabilité des données » : bloc à bordure pointillée, visuellement séparé des indicateurs d'impact
- Tableaux (coordinateur) : lignes simples, badges de statut (pilule sombre = actif, pilule claire = formé, pilule estompée = inactif)

## 4. Périmètre fonctionnel

### 4.1 Authentification et profil

- Connexion sans mot de passe par e-mail (lien magique / OTP Supabase Auth). Aucune auto-inscription : les comptes sont créés par un admin/coordinateur qui invite le médiateur par e-mail.
- Profil médiateur : prénom, nom, université/campus, langues parlées, statut (candidat, sélectionné, formé, actif, inactif), disponibilité, consentement à la charte (horodaté), consentement RGPD (horodaté).
- Écran d'onboarding obligatoire avant la première utilisation : charte du médiateur + texte d'information RGPD (voir §6), chacun avec sa propre case à cocher horodatée. Impossible d'accéder au reste de l'application tant que les deux cases ne sont pas cochées.

### 4.2 Formulaire « Nouvelle activité »

Une seule page scrollable (pas de wizard). Champs :

| Champ | Type | Règle |
|---|---|---|
| Date | date | requis, ≤ aujourd'hui |
| Lieu / université | select (liste de campus configurée) | requis |
| Type d'activité | chips à sélection unique (9 valeurs : conversation individuelle, petit groupe, atelier, stand, réunion associative, WhatsApp, réseaux sociaux, événement, présence collecte) | requis |
| Personnes atteintes | stepper +/− | ≥ 0 |
| Conversations significatives | stepper +/− | ≥ 0 et ≤ personnes atteintes |
| Personnes intéressées | stepper +/− | ≥ 0 et ≤ personnes atteintes |
| Support utilisé | chips à sélection unique + « Autre » en texte libre (flyer, affiche, brochure, vidéo, carte-réponse, lien EFS, aucun, autre) | optionnel |
| Durée | chips à sélection unique (15 min / 30 min / 45 min / 1h / 1h30 / 2h+) | optionnel |
| Note anonyme | texte libre | optionnel — jamais de nom, contact ou donnée médicale |

**Orientations intégrées au formulaire** : compteur « X orientation(s) enregistrée(s) pour cette activité » + bouton « + Ajouter une orientation » ouvrant le sous-formulaire décrit en 4.3, avant l'enregistrement final. **Aucun blocage** : l'activité s'enregistre même sans orientation ni frein renseigné, sans confirmation forcée.

**Sur la liste des activités** : badge discret non bloquant « à compléter » si personnes intéressées > 0 sans orientation liée, ou si aucun frein n'est renseigné. Sur l'écran de détail : action rapide « + Ajouter un frein » (une orientation ne peut plus être ajoutée après coup, voir §0 point 6 — uniquement au moment de la création de l'activité).

### 4.3 Formulaire « Nouvelle orientation »

Intégré uniquement au formulaire d'activité (§4.2) — pas d'accès autonome (voir §0, point 6). Strictement anonyme.

| Champ | Type |
|---|---|
| Collecte concernée | select (collectes créées à l'avance par l'admin), optionnel |
| Date | date, requis |
| Canal | chips (en personne, WhatsApp, réseaux sociaux, téléphone, autre) |
| Statut de suivi | liste à sélection unique (information transmise / lien EFS partagé / intéressé·e / présence confirmée) |

**Règle absolue** : aucune colonne nom, téléphone, e-mail ou identifiant de contact dans `orientations`, ni maintenant ni en champ optionnel « pour plus tard ». L'EFS gère elle-même tout rappel.

### 4.4 Journal des freins

Multi-select (chips), jamais de radio. 11 catégories fixes + « Autre » (texte libre) :

1. Manque d'information · 2. Peurs · 3. Croyances et idées reçues · 4. Manque de confiance · 5. Santé ou éligibilité · 6. Disponibilité · 7. Motivation · 8. Expérience précédente · 9. Communication · 10. Représentation · 11. Autre

Chaque frein sélectionné est lié à l'activité via `activity_barriers` (many-to-many). Une activité doit obligatoirement être associée (sélection dans un menu déroulant si accès depuis l'onglet autonome). Note libre commune aux catégories cochées sur une même saisie.

### 4.5 Module de tracking EFS (liens courts)

- Lien court unique par médiateur et/ou par activité, redirection HTTP 302 vers l'URL officielle EFS.
- Chaque clic incrémente un compteur anonyme (`link_clicks.click_count`) associé au médiateur/à l'activité.
- Aucune IP conservée au-delà d'un usage anti-bot immédiat (rate-limiting en mémoire, jamais persisté).
- Alimente l'indicateur de « fiabilité des données » (écart déclaratif) au dashboard coordinateur — **jamais** présenté comme un indicateur d'impact.

### 4.6 CRUD complet

Toutes les entités (profil, activités, orientations, freins) : liste avec recherche/filtre simple par date, écran de détail/édition, état vide clair (« Aucune activité enregistrée pour l'instant — créez la première »).

**Suppression** :
- Médiateur : jamais de suppression réelle → archivage (`archived_at`), exclu des statistiques, conservé en historique et journal d'audit.
- Admin uniquement : suppression définitive, avec confirmation explicite (double confirmation + saisie du mot « SUPPRIMER » ou équivalent).
- Tous les compteurs/indicateurs du dashboard excluent systématiquement `archived_at IS NOT NULL`.

Écrans CRUD équivalents côté coordinateur/admin pour la gestion des médiateurs et des comptes (y compris invitation d'un nouveau médiateur).

### 4.7 Tableau de bord médiateur (« Mes statistiques »)

Données strictement personnelles, jamais de comparaison :

- Activités réalisées (total + 30 derniers jours)
- Personnes sensibilisées, conversations significatives, personnes intéressées
- Orientations enregistrées
- Freins les plus fréquents remontés par ce médiateur
- Progression mensuelle personnelle (graphique simple, 6 derniers mois)

Pas de gamification, pas de classement.

### 4.8 Tableau de bord coordinateur/admin

Accessible uniquement aux rôles `coordinator` et `admin`. Chaque indicateur porte une infobulle reprenant **exactement** les définitions verrouillées (§5).

**Section 0 — Objectifs vs réalisé** (en premier, la plus visible pour un lecteur externe EFS/financeur)
- Personnes sensibilisées : réalisé / objectif 500, % d'avancement
- Nouveaux donneurs : réalisé / objectif 60–80, saisi manuellement par l'admin après retour officiel EFS

**Section 1 — Indicateurs d'impact** (cartes)
- Médiateurs recrutés / formés / actifs, taux de rétention
- Activités menées, personnes sensibilisées, conversations significatives
- Personnes intéressées, orientations, ratio orientations/personnes intéressées

**Section 2 — Répartitions** (graphiques)
- Activités par campus
- Freins les plus fréquents, comptés **par occurrence de catégorie** (pas par activité) — méthode explicitée via infobulle
- Progression mensuelle (courbe)

**Section 3 — Résultats officiels des collectes**
- Saisie manuelle admin uniquement, après chaque collecte (nombre de donneurs, primo-donneurs) — jamais déduit ou estimé par l'application
- Aucun champ « don réalisé » côté médiateur, nulle part

**Section 4 — Fiabilité des données** (visuellement séparée, jamais mélangée aux indicateurs d'impact)
- Clics sur liens EFS trackés (donnée anonyme)
- Écart orientations déclarées / clics enregistrés — indicateur de qualité de saisie (« aide à identifier un besoin de formation, pas à mesurer l'impact du programme »)

## 5. Définitions verrouillées

À reprendre telles quelles dans le code (infobulles) et toute communication externe.

> **Personne sensibilisée** : une personne ayant reçu une information sur le don de sang dans le cadre d'une action de sensibilisation menée par un médiateur BOMOI, quel que soit le canal utilisé. Aucune intention de donner n'est requise.

> **Conversation significative** : un échange individuel entre un médiateur et une personne, permettant de répondre à ses questions, d'identifier ses éventuelles inquiétudes ou freins et de présenter les principales informations relatives au don de sang. Va au-delà d'une simple remise de documentation ou d'un échange très bref.

> **Personne intéressée** : une personne ayant exprimé explicitement son intérêt pour donner son sang ou souhaitant obtenir davantage d'informations après une conversation significative.

> **Orientation** : action consistant à mettre une personne intéressée en relation avec une opportunité concrète de don (collecte, maison du don, plateforme de prise de rendez-vous EFS) en lui fournissant les informations nécessaires.

> **Don réalisé** : don de sang effectivement réalisé auprès de l'EFS, confirmé selon le processus défini conjointement entre BOMOI et l'EFS. Ce statut ne peut jamais être déclaré par le médiateur.

## 6. RGPD

### 6.1 Base légale

Traitement fondé sur l'**intérêt légitime** de BOMOI et de l'EFS à mesurer l'impact d'une action de sensibilisation au don du sang menée dans le cadre d'un partenariat associatif à but non lucratif, ainsi que sur le **consentement explicite** du médiateur bénévole pour le traitement de ses propres données de compte (recueilli à l'onboarding, horodaté, révocable).

Aucune donnée à caractère personnel n'est collectée sur les personnes sensibilisées ou orientées : le traitement les concernant est strictement statistique et anonyme dès la collecte (pas de pseudonymisation a posteriori — l'anonymat est structurel, par absence de toute colonne identifiante).

### 6.2 Minimisation

- Aucune donnée médicale, groupe sanguin ou d'éligibilité au don.
- Aucune origine ethnique.
- Aucun nom, identifiant ou coordonnée d'une personne sensibilisée ou orientée, y compris dans le module de tracking EFS (compteur anonyme uniquement, aucune IP conservée).
- Les seules données personnelles du système concernent les comptes des médiateurs/coordinateurs/admins eux-mêmes (bénévoles ayant consenti), pour les besoins de gestion du programme.

### 6.3 Durées de conservation

*(durées définitives à confirmer par BOMOI ; le code est structuré pour permettre une purge par date dès maintenant)*

| Donnée | Durée | Mécanisme |
|---|---|---|
| Activités, freins, orientations | Durée du programme + 3 ans, puis anonymisation ou suppression | Requête de purge planifiable sur `created_at` |
| Comptes médiateurs inactifs | Anonymisation 12 mois après la fin de l'engagement | Tâche planifiée basée sur `mediators.status = 'inactif'` + date de passage à ce statut |
| Journaux techniques (logs applicatifs/infrastructure) | 12 mois | Configuration Vercel/Supabase |
| `audit_logs` | Alignée sur la durée du programme + 3 ans (traçabilité des suppressions) | Purge manuelle admin |

### 6.4 Droits des personnes

Les médiateurs disposent d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition sur leurs propres données de compte et d'activité. Ces droits s'exercent auprès du coordinateur BOMOI (contact indiqué dans l'application). Aucun droit ne s'applique aux personnes sensibilisées/orientées puisqu'aucune donnée ne permet de les identifier.

### 6.5 Texte d'information RGPD (onboarding)

Affiché intégralement à l'écran d'onboarding, avec case à cocher horodatée séparée de celle de la charte :

> Dans le cadre de votre mission de médiateur BOMOI, vous pouvez être amené à recueillir certaines informations lors de vos échanges avec le public. Ces informations sont collectées exclusivement afin de mesurer l'impact des actions de sensibilisation, mieux comprendre les freins au don de sang, améliorer les actions de médiation et suivre les orientations vers l'EFS. Aucune donnée médicale ne doit être demandée ou enregistrée. Vous vous engagez à respecter la confidentialité des échanges, à ne collecter que les informations nécessaires, à informer les personnes de la finalité de la collecte, à ne jamais partager les données avec des personnes non autorisées, et à signaler immédiatement tout incident concernant les données. Les données sont traitées conformément au RGPD. Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition sur vos propres données de compte et d'activité — pour les exercer, contactez le coordinateur BOMOI.

## 7. Structure de données (résumé)

9 tables, RLS activée dès la première migration, UUID partout, `created_at`/`updated_at` systématiques : `profiles`, `mediators`, `activities`, `orientations`, `barriers`, `activity_barriers`, `link_clicks`, `aggregate_collection_results`, `audit_logs`. Détail complet dans `ARCHITECTURE.md` et `supabase/migrations/0001_init.sql`.

## 8. Contraintes non fonctionnelles

- PWA installable, mobile-first pour les écrans médiateur ; desktop/tablette pour le dashboard coordinateur — même déploiement Vercel, même repo.
- Support hors-ligne basique : file d'attente locale des formulaires (IndexedDB), bandeau « Hors ligne — sera synchronisé dès que possible », synchronisation automatique au retour réseau.
- Interface entièrement en français.
- Accessibilité de base : contrastes suffisants (vérifiés sur la palette ci-dessus), cibles tactiles ≥ 44px (steppers, chips), champs numériques en steppers plutôt que clavier natif.
