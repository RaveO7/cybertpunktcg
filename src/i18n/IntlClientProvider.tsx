"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { getMessageFallback, onIntlError } from "@/i18n/errors";

/** Fournisseur next-intl côté client, avec le même traitement des textes manquants que le serveur. */
export function IntlClientProvider(props: Omit<ComponentProps<typeof NextIntlClientProvider>, "onError" | "getMessageFallback">) {
  return <NextIntlClientProvider {...props} onError={onIntlError} getMessageFallback={getMessageFallback} />;
}
