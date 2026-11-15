import { revalidatePath } from "next/cache";

// Tables lues par l'annuaire de l'accueil des visiteurs (tournois publics, places restantes, boutiques).
const HOME_DIRECTORY_MODELS = new Set(["Tournament", "TournamentPlayer", "Shop"]);
const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

export function changesHomeDirectory(model: string | undefined, operation: string) {
  return model !== undefined && HOME_DIRECTORY_MODELS.has(model) && WRITE_OPERATIONS.has(operation);
}

/**
 * L'accueil est généré à l'avance (src/app/[locale]/page.tsx) : après une écriture dans l'annuaire, il
 * est régénéré à la visite suivante, dans toutes les langues.
 */
export function revalidateHome() {
  try {
    revalidatePath("/[locale]", "page");
  } catch (error) {
    // Écriture hors d'une requête Next (script, test) : aucune page en cache à régénérer ici.
    if (error instanceof Error && error.message.startsWith("Invariant: static generation store missing")) return;
    throw error;
  }
}
