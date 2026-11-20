"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";
import { DeckEditor } from "@/components/decks/DeckEditor";
import { DeckList } from "@/components/decks/DeckList";
import { useDecks } from "@/components/decks/hooks";
import { BackLink } from "@/components/decks/ui";
import { ScreenError, ScreenSkeleton, SkeletonBlock } from "@/components/site/ScreenSkeleton";

export function DecksScreen() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deck");
  const { catalog, ready: collectionReady, error: collectionError, retry, requireCatalog } = useCollection();
  const decks = useDecks();
  const needsCatalog = Boolean(deckId) || decks.decks.length > 0;
  useEffect(() => {
    if (needsCatalog) requireCatalog();
  }, [needsCatalog, requireCatalog]);

  const failure = collectionError
    ? { message: collectionError, retry }
    : decks.error
      ? { message: decks.error, retry: decks.retry }
      : null;
  if (failure) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-3 py-4 sm:px-4 sm:py-6">
        <ScreenError message={failure.message} onRetry={failure.retry} />
      </div>
    );
  }
  if (!decks.ready) return <DecksSkeleton />;
  // Aucun deck : la liste vide s'affiche sans le catalogue, qui ne sert qu'à résumer les decks (pas chargé
  // sur cette page tant qu'il n'est pas réclamé, cf. useCatalogGate).
  if (!needsCatalog) {
    return <DeckList decks={decks.decks} catalog={null} onCreate={decks.create} onDelete={decks.remove} />;
  }
  if (!collectionReady || !catalog) return <DecksSkeleton />;

  if (deckId) {
    const deck = decks.decks.find((entry) => entry.id === deckId);
    if (!deck) {
      return (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-3 px-3 py-6 sm:px-4">
          <p className="text-sm text-muted">{t("decks.notFound")}</p>
          <BackLink />
        </div>
      );
    }
    return <DeckEditor key={deck.id} deck={deck} catalog={catalog} onSaved={decks.replace} onDelete={decks.remove} />;
  }
  return <DeckList decks={decks.decks} catalog={catalog} onCreate={decks.create} onDelete={decks.remove} />;
}

/** Squelette des decks : titre, puis la grille des decks (jamais « aucun deck » avant les données). */
export function DecksSkeleton() {
  const t = useTranslations();
  return (
    <ScreenSkeleton
      label={t("decks.loading")}
      className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-5 px-3 pt-4 pb-24 sm:gap-6 sm:px-4 sm:py-6"
    >
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-8 w-40 sm:h-10" />
        <SkeletonBlock className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonBlock key={index} className="h-48" />
        ))}
      </div>
    </ScreenSkeleton>
  );
}
