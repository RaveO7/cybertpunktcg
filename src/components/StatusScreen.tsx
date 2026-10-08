"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/components/LocaleProvider";

/** Écran plein (erreur, 404) dans le style des pages du classeur partagé. */
export function StatusScreen({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="font-mono text-xs tracking-[0.18em] text-cyan">{eyebrow}</p>
      <h1 className="mt-1 text-2xl text-yellow">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {children}
        <Link
          href="/"
          className="inline-flex h-12 items-center border border-line px-4 text-sm text-muted hover:border-cyan hover:text-foreground"
        >
          {t.errors.home}
        </Link>
      </div>
    </div>
  );
}
