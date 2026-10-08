"use client";

import { useI18n } from "@/components/LocaleProvider";
import { StatusScreen } from "@/components/StatusScreen";

export default function NotFound() {
  const { t } = useI18n();
  return <StatusScreen eyebrow={t.errors.notFoundEyebrow} title={t.errors.notFoundTitle} body={t.errors.notFoundBody} />;
}
