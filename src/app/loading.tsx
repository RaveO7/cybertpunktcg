"use client";

import { useI18n } from "@/components/LocaleProvider";

export default function Loading() {
  const { t } = useI18n();
  return <p className="p-6 text-sm text-muted">{t.common.loading}</p>;
}
