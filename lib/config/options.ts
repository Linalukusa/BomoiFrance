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

// Doit rester synchronisé avec la contrainte CHECK sur activities.duration.
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

// Doit rester synchronisé avec la contrainte CHECK sur orientations.channel.
export const ORIENTATION_CHANNEL_OPTIONS = [
  { value: "en_personne", label: "En personne" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reseaux_sociaux", label: "Réseaux sociaux" },
  { value: "telephone", label: "Téléphone" },
  { value: "autre", label: "Autre" },
] as const;

// Doit rester synchronisé avec la contrainte CHECK sur orientations.status.
// 4 statuts (PRODUCT_REQUIREMENTS.md §0, point 2) — pas de "Rendez-vous
// déclaré" : un médiateur ne peut pas confirmer qu'un rendez-vous a
// réellement été pris.
export const ORIENTATION_STATUS_OPTIONS = [
  { value: "information_transmise", label: "Information transmise" },
  { value: "lien_efs_partage", label: "Lien EFS partagé" },
  { value: "interesse", label: "Intéressé·e" },
  { value: "presence_confirmee", label: "Présence confirmée" },
] as const;

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
