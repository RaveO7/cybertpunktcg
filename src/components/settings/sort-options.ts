import type { Translator } from "@/i18n/translator";
import type { SortKey } from "@/lib/types";

export function sortOptions(t: Translator): { value: SortKey; label: string }[] {
  return [
    { value: "default", label: t("cards.sortDefault") },
    { value: "number-asc", label: t("cards.sortNumberAsc") },
    { value: "number-desc", label: t("cards.sortNumberDesc") },
    { value: "price-asc", label: t("cards.sortPriceAsc") },
    { value: "price-desc", label: t("cards.sortPriceDesc") },
    { value: "play-cost-asc", label: t("cards.sortPlayCostAsc") },
    { value: "play-cost-desc", label: t("cards.sortPlayCostDesc") },
    { value: "power-asc", label: t("cards.sortPowerAsc") },
    { value: "power-desc", label: t("cards.sortPowerDesc") },
    { value: "ram-asc", label: t("cards.sortRamAsc") },
    { value: "ram-desc", label: t("cards.sortRamDesc") },
    { value: "qty-asc", label: t("cards.sortQtyAsc") },
    { value: "qty-desc", label: t("cards.sortQtyDesc") },
    { value: "name-asc", label: t("cards.sortNameAsc") },
    { value: "name-desc", label: t("cards.sortNameDesc") },
    { value: "rarity", label: t("cards.sortRarity") },
    { value: "set", label: t("cards.groupSet") },
    { value: "owned-first", label: t("cards.groupOwnedFirst") },
    { value: "missing-first", label: t("cards.groupMissingFirst") },
  ];
}
