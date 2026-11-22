"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";
import { useDecks } from "@/components/decks/hooks";
import { useRouter } from "@/i18n/navigation";

/** Création d'un deck depuis l'en-tête de la page, puis ouverture de son éditeur. Affiché une fois le compte connu. */
export function NewDeckButton() {
  const t = useTranslations("decks");
  const router = useRouter();
  const { user } = useCollection();
  const { create } = useDecks();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user) return null;

  async function createDeck() {
    setPending(true);
    setMessage(null);
    try {
      const deck = await create({ name: t("defaultName") });
      router.push({ pathname: "/decks", query: { deck: deck.id } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Mobile : flottant au centre, juste au-dessus de la barre d'onglets, pour le pouce. */}
      <button
        type="button"
        className="fixed bottom-[calc(var(--app-bottom-nav)+1rem)] left-1/2 z-30 inline-flex h-12 -translate-x-1/2 items-center justify-center bg-yellow px-6 text-sm font-semibold text-black shadow-lg shadow-black/50 hover:brightness-110 disabled:opacity-50 sm:static sm:h-10 sm:translate-x-0 sm:px-4 sm:shadow-none"
        disabled={pending}
        onClick={() => void createDeck()}
      >
        {t("newDeck")}
      </button>
      {message ? (
        <p role="alert" className="basis-full text-sm text-danger">
          {message}
        </p>
      ) : null}
    </>
  );
}
