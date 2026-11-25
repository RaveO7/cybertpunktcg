// Colonnes JSON du tournoi relues de la base : validées à la lecture plutôt que castées.
import { z } from "zod";
import type { CommandResult } from "./commands";
import type { CutState } from "./service";
import type { MatchResult } from "./scores";
import type { CutDraw } from "./top-cut";

const matchResultSchema = z.object({
  kind: z.enum(["normal", "bye", "double_loss", "id", "no_show"]),
  gamesA: z.number(),
  gamesB: z.number(),
});

const cutStateSchema = z.object({ size: z.number(), seeds: z.array(z.string()) });

const cutDrawsSchema = z.array(z.object({ tied: z.array(z.string()), picked: z.array(z.string()), at: z.string() }));

const commandWarningSchema = z.union([
  z.object({ type: z.literal("rematch"), a: z.string(), b: z.string() }),
  z.object({ type: z.literal("second_bye"), playerId: z.string() }),
  z.object({ type: z.literal("draft_outdated") }),
  z.object({ type: z.literal("correction_after_pairing"), matchId: z.string() }),
]);

const commandResultSchema = z.object({
  ok: z.literal(true),
  warnings: z.array(commandWarningSchema).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  replayed: z.boolean().optional(),
});

/** Lit une colonne JSON : `null` si elle est vide, absente ou ne respecte pas le schéma. */
function readJson<T>(schema: z.ZodType<T>, json: string | null): T | null {
  if (!json) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    // JSON illisible : traité comme une colonne vide, l'appelant a une valeur de repli.
    return null;
  }
}

export function readMatchResult(json: string | null): MatchResult | null {
  return readJson(matchResultSchema, json);
}

export function readCutState(json: string | null): CutState | null {
  return readJson(cutStateSchema, json);
}

export function readCutDrawList(json: string | null): CutDraw[] {
  return readJson(cutDrawsSchema, json) ?? [];
}

/** Résultat d'une commande déjà appliquée ; un journal corrompu est un bug : on lève. */
export function readCommandResult(json: string): CommandResult {
  const parsed = commandResultSchema.parse(JSON.parse(json));
  return { ...parsed, replayed: true };
}
