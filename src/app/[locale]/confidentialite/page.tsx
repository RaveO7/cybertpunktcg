import { getLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/LegalPage";

export async function generateMetadata() {
  return legalMetadata(await getLocale(), "privacy");
}

export default async function PrivacyPage() {
  return <LegalPage locale={await getLocale()} page="privacy" />;
}
