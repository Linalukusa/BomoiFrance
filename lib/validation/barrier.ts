import { z } from "zod";

/**
 * Une activité doit obligatoirement être associée (PRD §4.4) — jamais de
 * frein flottant sans activité, contrairement à l'orientation avant son
 * retrait de l'accès autonome.
 */
export const barrierEntrySchema = z.object({
  activity_id: z.string().uuid({ message: "Merci de choisir une activité." }),
  barrier_ids: z.array(z.string().uuid()).min(1, "Sélectionnez au moins un frein."),
  note: z.string().optional(),
});

export type BarrierEntryInput = z.infer<typeof barrierEntrySchema>;
