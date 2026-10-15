import type { useTranslations } from "next-intl";

/** Fonction de traduction à la racine des messages, transmise aux fonctions utilitaires des composants. */
export type Translator = ReturnType<typeof useTranslations<never>>;

/** Clé de message construite à l'exécution (statut, type…) : à vérifier avec `t.has` si elle peut manquer. */
export type MessageKey = Parameters<Translator>[0];
