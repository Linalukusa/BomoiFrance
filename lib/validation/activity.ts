import { z } from "zod";
import { ACTIVITY_TYPE_OPTIONS, DURATION_OPTIONS } from "@/lib/config/options";

const ACTIVITY_TYPE_VALUES = ACTIVITY_TYPE_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
];
const DURATION_VALUES = DURATION_OPTIONS.map((o) => o.value) as [string, ...string[]];

export function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Mêmes règles que les contraintes CHECK de activities (0001_init.sql) :
 * aucune valeur négative, conversations significatives et personnes
 * intéressées ≤ personnes atteintes. Utilisée côté serveur comme rempart
 * (l'UI elle-même — steppers bornés — empêche déjà d'atteindre un état
 * invalide, voir Stepper.tsx).
 */
export const activitySchema = z
  .object({
    activity_date: z
      .string()
      .min(1, "La date est requise.")
      .refine((value) => value <= todayISODate(), "La date ne peut pas être dans le futur."),
    campus: z.string().min(1, "Le lieu / université est requis."),
    activity_type: z.enum(ACTIVITY_TYPE_VALUES, {
      message: "Le type d'activité est requis.",
    }),
    people_reached: z.coerce.number().int().min(0, "Ne peut pas être négatif."),
    meaningful_conversations: z.coerce.number().int().min(0, "Ne peut pas être négatif."),
    interested_people: z.coerce.number().int().min(0, "Ne peut pas être négatif."),
    support_used: z.string().optional(),
    duration: z.enum([...DURATION_VALUES, ""]).optional(),
    note: z.string().optional(),
  })
  .refine((data) => data.meaningful_conversations <= data.people_reached, {
    message: "Les conversations significatives ne peuvent pas dépasser les personnes atteintes.",
    path: ["meaningful_conversations"],
  })
  .refine((data) => data.interested_people <= data.people_reached, {
    message: "Les personnes intéressées ne peuvent pas dépasser les personnes atteintes.",
    path: ["interested_people"],
  });

export type ActivityInput = z.infer<typeof activitySchema>;
