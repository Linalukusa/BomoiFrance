import { z } from "zod";
import { MEDIATOR_STATUS_OPTIONS } from "@/lib/config/options";

const STATUS_VALUES = MEDIATOR_STATUS_OPTIONS.map((o) => o.value) as [string, ...string[]];

/**
 * Édition "hors rôle" (PRD §4.6, Étape 9) : ce schéma ne contient
 * volontairement aucun champ role — profiles.role ne se modifie que via la
 * RPC set_user_role (admin uniquement, cf. actions.ts / SECURITY.md).
 */
export const mediatorSchema = z.object({
  first_name: z.string().min(1, "Le prénom est requis."),
  last_name: z.string().min(1, "Le nom est requis."),
  university: z.string().min(1, "L'université est requise."),
  status: z.enum(STATUS_VALUES, { message: "Statut invalide." }),
  availability: z.string().optional(),
  languages: z.string().optional(),
});

export type MediatorInput = z.infer<typeof mediatorSchema>;
