import { getLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/LegalPage";

export async function generateMetadata() {
  return legalMetadata(await getLocale(), "terms");
}

export default async function TermsPage() {
  return <LegalPage locale={await getLocale()} page="terms" />;
}
