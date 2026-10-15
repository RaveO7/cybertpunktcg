"use client";

import { useTranslations } from "next-intl";
import { StatusScreen } from "@/components/StatusScreen";

export default function NotFound() {
  const t = useTranslations();
  return <StatusScreen eyebrow={t("errors.notFoundEyebrow")} title={t("errors.notFoundTitle")} body={t("errors.notFoundBody")} />;
}
