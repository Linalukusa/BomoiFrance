/**
 * Listes fixes gérées comme configuration applicative plutôt que comme tables
 * Supabase, pour rester alignées avec le principe de minimalisme des 9 tables.
 * Voir ARCHITECTURE.md §3bis.
 */

export const CAMPUS_OPTIONS = [
  "Toulouse III – Paul Sabatier",
  "Toulouse Capitole",
  "Toulouse – Jean Jaurès",
  "INSA Toulouse",
  "Toulouse INP",
] as const;

// Doit rester synchronisé avec la contrainte CHECK sur activities.activity_type
// (supabase/migrations/0001_init.sql).
export const ACTIVITY_TYPE_OPTIONS = [
  { value: "conversation_individuelle", label: "Conversation individuelle" },
  { value: "petit_groupe", label: "Petit groupe" },
  { value: "atelier", label: "Atelier" },
  { value: "stand", label: "Stand" },
  { value: "reunion_associative", label: "Réunion associative" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reseaux_sociaux", label: "Réseaux sociaux" },
  { value: "evenement", label: "Événement" },
  { value: "presence_collecte", label: "Présence collecte" },
] as const;

// @deprecated V2 : la durée est désormais calculée depuis started_at/ended_at
// (écran terrain). Conservée uniquement pour afficher la durée des actions
// closes avant la V2 (activities.duration, jamais réécrite depuis).
export const DURATION_OPTIONS = [
  { value: "15min", label: "15 min" },
  { value: "30min", label: "30 min" },
  { value: "45min", label: "45 min" },
  { value: "1h", label: "1h" },
  { value: "1h30", label: "1h30" },
  { value: "2h_plus", label: "2h+" },
] as const;

// Liste verrouillée avec BOMOI (PRODUCT_REQUIREMENTS.md §0). activities.support_used
// reste un champ texte libre en base : "Autre" est suivi d'une saisie libre.
export const SUPPORT_USED_OPTIONS = [
  "Flyer",
  "Affiche",
  "Brochure",
  "Vidéo",
  "Carte-réponse",
  "Lien EFS",
  "Aucun",
  "Autre",
] as const;

// Doit rester synchronisé avec la contrainte CHECK sur activities.period
// (supabase/migrations/0007_v2_activity_flow.sql).
export const PERIOD_OPTIONS = [
  { value: "cours", label: "Période de cours" },
  { value: "examens", label: "Examens" },
  { value: "rentree", label: "Rentrée" },
  { value: "vacances", label: "Vacances" },
] as const;

// Doit rester synchronisé avec la contrainte CHECK sur activities.audience.
export const AUDIENCE_OPTIONS = [
  { value: "etudiants", label: "Étudiants" },
  { value: "personnel", label: "Personnel" },
  { value: "mixte", label: "Mixte" },
  { value: "grand_public", label: "Grand public" },
] as const;

// Doit rester synchronisé avec la contrainte CHECK sur activities.event_context.
export const EVENT_CONTEXT_OPTIONS = [
  { value: "aucun", label: "Aucun" },
  { value: "collecte_dans_la_semaine", label: "Collecte dans la semaine" },
  { value: "journee_mondiale", label: "Journée mondiale du don de sang" },
  { value: "evenement_campus", label: "Événement campus" },
  { value: "autre", label: "Autre" },
] as const;

// Version des listes fermées ci-dessus, enregistrée sur chaque activité
// (activities.category_version) pour pouvoir toujours interpréter les
// données passées même après un futur remaniement des listes. À incrémenter
// avec une nouvelle migration (nouveau défaut de colonne) chaque fois qu'une
// liste fermée de ce fichier change de façon à changer le sens des valeurs
// historiques déjà enregistrées.
export const CATEGORY_VERSION = "2026-11";

// Doit rester synchronisé avec la contrainte CHECK sur mediators.status.
export const MEDIATOR_STATUS_OPTIONS = [
  { value: "candidat", label: "Candidat" },
  { value: "selectionne", label: "Sélectionné" },
  { value: "forme", label: "Formé" },
  { value: "actif", label: "Actif" },
  { value: "inactif", label: "Inactif" },
] as const;

export const PROFILE_ROLE_OPTIONS = [
  { value: "mediator", label: "Médiateur" },
  { value: "coordinator", label: "Coordinateur" },
  { value: "admin", label: "Admin" },
] as const;
