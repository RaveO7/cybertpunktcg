"use client";

import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations();
  return <p className="p-6 text-sm text-muted">{t("common.loading")}</p>;
}
