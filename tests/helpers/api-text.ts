import assert from "node:assert/strict";
import { createTranslator } from "next-intl";
import messages from "../../src/i18n/messages/fr";
import { AppError } from "../../src/lib/app-error";

const t = createTranslator({ locale: "fr", messages, namespace: "api" }) as unknown as (
  key: string,
  values?: Record<string, string | number>,
) => string;

/** Texte français d'un refus métier (les erreurs portent une clé du bloc `api`). */
export function frenchText(error: unknown): string {
  if (error instanceof AppError) return t(error.key, error.values);
  return error instanceof Error ? error.message : String(error);
}

/** La promesse est refusée avec un message dont le texte français correspond au motif. */
export async function rejectsWith(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.match(frenchText(error), pattern);
    return true;
  });
}
