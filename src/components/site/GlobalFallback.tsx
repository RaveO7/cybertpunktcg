"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { splitLocale } from "@/i18n/match";
import de from "@/i18n/messages/de/errors.json";
import en from "@/i18n/messages/en/errors.json";
import es from "@/i18n/messages/es/errors.json";
import fr from "@/i18n/messages/fr/errors.json";
import it from "@/i18n/messages/it/errors.json";
import { localizedPath } from "@/i18n/paths";
import { SITE } from "@/lib/site";

// Pages rendues hors des mises en page (erreur du layout racine, URL sans route) : pas de
// fournisseur de traductions. Le bloc « errors » de chaque langue est importé ici, et la langue est
// celle de l'URL, lue dans le navigateur (le rendu serveur est en français).
const COPY: Record<Locale, typeof fr> = { fr, en, de, es, it };

const noSubscribe = () => () => undefined;

function useUrlLocale(): Locale {
  return useSyncExternalStore(
    noSubscribe,
    () => splitLocale(window.location.pathname).locale,
    () => DEFAULT_LOCALE,
  );
}

type Props =
  | { kind: "error"; digest?: string; retry: () => void; style: Record<string, React.CSSProperties> }
  | { kind: "notFound" };

export function GlobalFallback(props: Props) {
  const locale = useUrlLocale();
  const copy = { ...fr, ...COPY[locale] };

  if (props.kind === "notFound") {
    return (
      <main lang={locale} className="mx-auto max-w-lg px-4 py-16 text-center">
        <title>{`${copy.notFoundTitle} · ${SITE.name}`}</title>
        <p className="font-mono text-xs tracking-[0.18em] text-cyan">{copy.notFoundEyebrow}</p>
        <h1 className="mt-1 text-2xl text-yellow">{copy.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted">{copy.notFoundBody}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={localizedPath("home", locale)}
            className="inline-flex h-12 items-center border border-line px-4 text-sm text-muted hover:border-cyan hover:text-foreground"
          >
            {copy.home}
          </a>
        </div>
      </main>
    );
  }

  const { style } = props;
  return (
    <main lang={locale} style={style.main}>
      <title>{`${copy.title} · ${SITE.name}`}</title>
      <p style={style.eyebrow}>{copy.eyebrow}</p>
      <h1 style={style.title}>{copy.title}</h1>
      <p style={style.body}>{copy.body}</p>
      <button type="button" onClick={() => props.retry()} style={style.button}>
        {copy.retry}
      </button>
      {props.digest ? (
        <p style={style.digest}>
          {copy.reference} {props.digest}
        </p>
      ) : null}
    </main>
  );
}
