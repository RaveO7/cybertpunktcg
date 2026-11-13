"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { disablePush, enablePush, readPushState, VAPID_PUBLIC_KEY, type PushState } from "@/lib/push-client";
import { WISHLIST_ENABLED } from "@/lib/site";

const PROMPT_DISMISSED_KEY = "cptcg-push-prompt-dismissed";
/** Option proposée seulement avec une clé publique VAPID et la liste de souhaits publiée. */
const PUSH_AVAILABLE = !!VAPID_PUBLIC_KEY && WISHLIST_ENABLED;

/** Notifications d'alerte de prix sur cet appareil. `hidden` : option masquée (voir PUSH_AVAILABLE). */
function usePushNotifications() {
  const locale = useLocale();
  const [state, setState] = useState<PushState | "loading" | "hidden">(PUSH_AVAILABLE ? "loading" : "hidden");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Résultat de la dernière action, à annoncer (une demande d'autorisation fermée sans réponse n'annonce rien).
  const [notice, setNotice] = useState<"enabled" | "disabled" | "denied" | null>(null);

  useEffect(() => {
    if (!PUSH_AVAILABLE) return;
    let alive = true;
    readPushState(locale)
      .then((next) => alive && setState(next))
      .catch(() => alive && setState("off"));
    return () => {
      alive = false;
    };
  }, [locale]);

  const run = useCallback(async (action: () => Promise<PushState>) => {
    setBusy(true);
    setFailed(false);
    setNotice(null);
    try {
      const next = await action();
      setState(next);
      return next;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    state,
    busy,
    failed,
    notice,
    enable: async () => {
      const next = await run(() => enablePush(locale));
      setNotice(next === "on" ? "enabled" : next === "denied" ? "denied" : null);
    },
    disable: async () => {
      if ((await run(async () => (await disablePush(), "off"))) === "off") setNotice("disabled");
    },
  };
}

/** Option des réglages : activer / désactiver sur cet appareil, ou pourquoi c'est impossible. */
export function PushSettingsSection() {
  const t = useTranslations("settings");
  const push = usePushNotifications();
  if (push.state === "hidden") return null;

  const explanation =
    push.state === "unsupported"
      ? t("pushUnsupported")
      : push.state === "ios-install"
        ? t("pushInstallIos")
        : push.state === "denied"
          ? t("pushDenied")
          : null;
  const status = push.failed
    ? t("pushFailed")
    : push.notice === "enabled"
      ? t("pushEnabled")
      : push.notice === "disabled"
        ? t("pushDisabled")
        : null;

  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="push-title" aria-busy={push.state === "loading"}>
      <h2 id="push-title" className="text-xs uppercase tracking-[0.14em] text-muted">
        {t("pushTitle")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("pushHint")}</p>
      {explanation ? (
        <p className="mt-4 border border-line p-3 text-sm text-foreground">{explanation}</p>
      ) : null}
      {push.state === "on" ? (
        <button
          type="button"
          disabled={push.busy}
          onClick={() => void push.disable()}
          className="mt-4 h-12 w-full border border-line text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-60"
        >
          {push.busy ? t("pushBusy") : t("pushDisable")}
        </button>
      ) : (
        <button
          type="button"
          disabled={push.busy || push.state !== "off"}
          onClick={() => void push.enable()}
          className="mt-4 h-12 w-full border border-cyan text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
        >
          {push.busy || push.state === "loading" ? t("pushBusy") : t("pushEnable")}
        </button>
      )}
      {status ? (
        <p className="mt-3 text-sm text-muted" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}

function readDismissed() {
  try {
    return window.localStorage.getItem(PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Proposition d'activer les notifications, dans la liste de souhaits, dès qu'une cible est définie.
 * Affichée seulement si l'appareil peut s'abonner et ne l'est pas, jusqu'à ce que l'utilisateur la ferme.
 */
export function WishlistPushPrompt({ hasTarget }: { hasTarget: boolean }) {
  const t = useTranslations("wishlist");
  const settings = useTranslations("settings");
  const push = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Lecture après le montage : le rendu serveur ne connaît pas le stockage local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
  }, []);

  if (!hasTarget || dismissed || (push.state !== "off" && !push.notice && !push.failed)) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(PROMPT_DISMISSED_KEY, "1");
    } catch {
      // Stockage indisponible : la proposition reviendra à la prochaine visite.
    }
  }

  const message =
    push.failed
      ? settings("pushFailed")
      : push.notice === "enabled"
        ? settings("pushEnabled")
        : push.notice === "denied"
          ? settings("pushDenied")
          : null;

  return (
    <div className="flex flex-col gap-3 border border-cyan/50 bg-cyan/5 p-4 sm:flex-row sm:items-center" role="region" aria-label={settings("pushTitle")}>
      <p className="flex-1 text-sm text-foreground" role={message ? "status" : undefined}>
        {message ?? t("pushPrompt")}
      </p>
      <div className="flex gap-2">
        {push.state === "off" ? (
          <button
            type="button"
            disabled={push.busy}
            onClick={() => void push.enable()}
            className="h-10 border border-cyan px-3 text-sm text-cyan hover:bg-cyan/10 disabled:opacity-60"
          >
            {push.busy ? settings("pushBusy") : t("pushPromptEnable")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="h-10 border border-line px-3 text-sm text-muted hover:border-cyan hover:text-cyan"
        >
          {t("pushPromptDismiss")}
        </button>
      </div>
    </div>
  );
}
