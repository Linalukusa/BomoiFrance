import { z } from "zod";
import { ORIENTATION_CHANNEL_OPTIONS, ORIENTATION_STATUS_OPTIONS } from "@/lib/config/options";
import { todayISODate } from "@/lib/validation/activity";

const CHANNEL_VALUES = ORIENTATION_CHANNEL_OPTIONS.map((o) => o.value) as [string, ...string[]];
const STATUS_VALUES = ORIENTATION_STATUS_OPTIONS.map((o) => o.value) as [string, ...string[]];

/**
 * Strictement anonyme (PRD §4.3, RÈGLE ABSOLUE) : aucun champ nom/téléphone/
 * e-mail/identifiant n'existe ici ni dans le schéma — ne jamais en ajouter,
 * même optionnel.
 */
export const orientationSchema = z.object({
  collection_id: z.string().uuid().optional().or(z.literal("")),
  orientation_date: z
    .string()
    .min(1, "La date est requise.")
    .refine((value) => value <= todayISODate(), "La date ne peut pas être dans le futur."),
  channel: z.enum(CHANNEL_VALUES, { message: "Le canal est requis." }),
  status: z.enum(STATUS_VALUES, { message: "Le statut de suivi est requis." }),
});

export type OrientationInput = z.infer<typeof orientationSchema>;
