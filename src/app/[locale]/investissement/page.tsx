import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { InvestmentScreen } from "@/components/InvestmentScreen";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

export default async function InvestmentPage() {
  const t = await getTranslations();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">{t("common.loading")}</p>}>
      <InvestmentScreen />
    </Suspense>
  );
}
