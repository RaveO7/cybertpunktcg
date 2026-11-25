import { z } from "zod";
import { apiMessage as m } from "../app-error";
import { normalizeDisplayName, normalizeEmail, normalizeLoginPassword, normalizePassword } from "../auth";
import { normalized } from "./common";

export const loginSchema = z.object({
  email: normalized(normalizeEmail, m("auth.invalidCredentials")),
  password: normalized(normalizeLoginPassword, m("auth.invalidCredentials")),
});

export const registerSchema = z.object({
  email: normalized(normalizeEmail, m("auth.invalidEmail")),
  password: normalized(normalizePassword, m("auth.passwordTooShort", { min: 8 })),
  displayName: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return null;
      const name = normalizeDisplayName(value);
      if (!name) {
        ctx.addIssue({ code: "custom", message: m("auth.displayNameLength", { min: 1, max: 40 }) });
        return z.NEVER;
      }
      return name;
    }),
  localUserId: z.string().trim().max(128).nullable().optional(),
});

/** Suppression du compte : confirmation explicite exigée dans le corps, jamais sur un simple appel. */
export const deleteAccountSchema = z.object({ confirm: z.literal(true) });
