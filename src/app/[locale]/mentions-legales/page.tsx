import { getLocale } from "next-intl/server";
import { LegalPage, legalMetadata } from "@/components/LegalPage";

export async function generateMetadata() {
  return legalMetadata(await getLocale(), "legalNotice");
}

export default async function LegalNoticePage() {
  return <LegalPage locale={await getLocale()} page="legalNotice" />;
}
