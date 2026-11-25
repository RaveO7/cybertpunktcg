import type { ReactNode } from "react";
import type { matchesExpect } from "@/lib/rules/demo-match";

export type TryAction = (action: Parameters<typeof matchesExpect>[1]) => void;

/** Éclat visuel posé sur une zone quand le dernier `flash` correspond (motif finissant par « * » = préfixe). */
export type BurstFn = (flashes: string[], color: string) => ReactNode;
