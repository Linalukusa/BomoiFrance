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
