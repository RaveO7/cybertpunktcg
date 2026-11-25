"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";
import { useCachedJson } from "@/components/data-cache";
import { api } from "@/lib/client/api";
import { useApiErrorMessage } from "@/lib/client/use-api-error-message";
import type { ShareInfo } from "@/lib/api-responses";

const SHARE_URL = "/api/share";
const NO_SHARE: ShareInfo = { active: false };

/** État du lien de partage du classeur et ses actions (créer, renouveler, révoquer, copier). */
export function useShareLink() {
  const { user } = useCollection();
  const t = useTranslations();
  // État du partage : copie en cache affichée aussitôt, rechargée à chaque visite.
  const shareQuery = useCachedJson(user ? SHARE_URL : null, "shareInfoSchema");
  const share = shareQuery.data ?? (shareQuery.error ? NO_SHARE : null);
  const setShare = (next: ShareInfo) => shareQuery.mutate(() => next);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const requestError = useApiErrorMessage();

  async function createShare(rotate = false) {
    setShareBusy(true);
    setShareNote(null);
    try {
      setShare(await api(SHARE_URL, { body: { rotate }, schema: "shareInfoSchema" }));
      setShareNote(rotate ? t("settings.shareRotated") : t("settings.shareCreated"));
    } catch (caught) {
      setShareNote(requestError(caught, t("settings.shareFailed")));
    } finally {
      setShareBusy(false);
    }
  }

  async function revokeShareLink() {
    setShareBusy(true);
    setShareNote(null);
    try {
      await api(SHARE_URL, { method: "DELETE" });
      setShare(NO_SHARE);
      setShareNote(t("settings.shareRevoked"));
    } catch (caught) {
      setShareNote(requestError(caught, t("settings.shareFailed")));
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    if (!share?.active) return;
    setShareNote(null);
    try {
      await navigator.clipboard.writeText(share.url);
      setShareNote(t("settings.shareCopied"));
    } catch {
      setShareNote(t("settings.shareCopyFailed"));
    }
  }

  return { share, shareBusy, shareNote, createShare, revokeShareLink, copyShareLink };
}
