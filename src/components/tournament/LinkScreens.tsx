"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError, postJson } from "./hooks";
import { panelClass, primaryClass } from "./ui";
import { useRouter } from "@/i18n/navigation";

function useLinkAction() {
  const t = useTranslations();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run<T>(action: () => Promise<T>, then: (result: T) => void) {
    setPending(true);
    setMessage(null);
    try {
      then(await action());
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 0 ? t("tournaments.offline") : error instanceof Error ? error.message : t("tournaments.failed"));
      setPending(false);
    }
  }
  return { pending, message, run };
}

/**
 * QR personnel scanné : il faut un geste explicite (un aperçu de lien ne doit pas consommer
 * le QR à usage unique).
 */
export function ClaimScreen({ token }: { token: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, message, run } = useLinkAction();
  return (
    <LinkPanel title={t("tournaments.claimTitle")} hint={t("tournaments.claimHint")} message={message}>
      <button
        type="button"
        className={`${primaryClass} h-12`}
        disabled={pending}
        onClick={() =>
          void run(
            () => postJson<{ code: string }>("/api/t/claim", { token }),
            (result) => router.replace({ pathname: "/t/[code]", params: { code: result.code } }),
          )
        }
      >
        {t("tournaments.claimButton")}
      </button>
    </LinkPanel>
  );
}

/** Invitation de co-organisateur (compte requis : la page est protégée). */
export function InviteScreen({ token }: { token: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { pending, message, run } = useLinkAction();
  return (
    <LinkPanel title={t("tournaments.inviteTitle")} hint={t("tournaments.inviteAcceptHint")} message={message}>
      <button
        type="button"
        className={`${primaryClass} h-12`}
        disabled={pending}
        onClick={() =>
          void run(
            () => postJson<{ tournamentId: string }>(`/api/tournaments/invite/${encodeURIComponent(token)}`, {}),
            (result) => router.replace({ pathname: "/tournois/[id]", params: { id: result.tournamentId } }),
          )
        }
      >
        {t("tournaments.acceptInvite")}
      </button>
    </LinkPanel>
  );
}

function LinkPanel({ title, hint, message, children }: { title: string; hint: string; message: string | null; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-3 py-6">
      <section className={`${panelClass} flex flex-col gap-3`}>
        <h1 className="text-xl text-yellow">{title}</h1>
        <p className="text-sm text-muted">{hint}</p>
        {message ? (
          <p role="alert" className="text-sm text-danger">
            {message}
          </p>
        ) : null}
        {children}
      </section>
    </div>
  );
}
