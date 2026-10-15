import { getLocale, getMessages, getTimeZone } from "next-intl/server";
import { HowToPlayScreen } from "@/components/HowToPlayScreen";
import { CLIENT_BLOCKS, pickBlocks } from "@/i18n/client-messages";
import { IntlClientProvider } from "@/i18n/IntlClientProvider";
import type { Messages } from "@/i18n/load";
import { privateMetadata } from "@/lib/seo/metadata";

// Règles et parcours interactif, réservés aux comptes (visiteurs renvoyés vers l'accueil par src/proxy.ts).
export const metadata = privateMetadata;

export default async function HowToPlayRoute() {
  // Règles, tutoriel et partie guidée : transmis au navigateur sur cette page seulement (blocs volumineux).
  const messages = pickBlocks((await getMessages()) as Messages, [...CLIENT_BLOCKS, "rules"]);
  return (
    <IntlClientProvider locale={await getLocale()} messages={messages} timeZone={await getTimeZone()}>
      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
        <HowToPlayScreen />
      </div>
    </IntlClientProvider>
  );
}
