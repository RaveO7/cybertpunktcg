"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";
import { useRouter } from "@/i18n/navigation";

export function DeleteAccountSection() {
  const { user, deleteAccount } = useCollection();
  const router = useRouter();
  const t = useTranslations();
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDeleteAccount() {
    setDeleteStep("busy");
    setDeleteError(null);
    try {
      await deleteAccount();
      router.replace("/");
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : t("settings.deleteFailed"));
      setDeleteStep("confirm");
    }
  }

  return (
    <section className="mt-10 border-t border-line pt-6" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title" className="text-xs uppercase tracking-[0.14em] text-danger">
        {t("settings.deleteTitle")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("settings.deleteHint")}</p>
      {deleteStep === "idle" ? (
        <button
          type="button"
          onClick={() => setDeleteStep("confirm")}
          className="mt-4 h-12 w-full border border-danger/60 text-sm text-danger hover:bg-danger/10"
        >
          {t("settings.deleteStart")}
        </button>
      ) : (
        <div className="mt-4 space-y-3 border border-danger/60 p-4">
          <p className="text-sm text-foreground">{t("settings.deleteConfirmText", { email: user?.email ?? "" })}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={deleteStep === "busy"}
              onClick={() => void onDeleteAccount()}
              className="h-11 border border-danger bg-danger/10 text-sm text-danger hover:bg-danger/20 disabled:opacity-60"
            >
              {deleteStep === "busy" ? t("settings.deleting") : t("settings.deleteConfirm")}
            </button>
            <button
              type="button"
              disabled={deleteStep === "busy"}
              onClick={() => {
                setDeleteStep("idle");
                setDeleteError(null);
              }}
              className="h-11 border border-line text-sm text-muted hover:border-cyan hover:text-cyan disabled:opacity-60"
            >
              {t("settings.deleteCancel")}
            </button>
          </div>
        </div>
      )}
      {deleteError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {deleteError}
        </p>
      ) : null}
    </section>
  );
}
