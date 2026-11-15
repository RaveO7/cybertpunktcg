import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { LoginScreen } from "@/components/site/LoginScreen";
import { translatorFor } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo/metadata";

// Page publique, sans donnée de compte : indexée pour les recherches « connexion » / « créer un compte ».
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await translatorFor(locale, "auth");
  return pageMetadata({ locale, page: { key: "login" }, title: t("title"), description: t("seoDescription") });
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
