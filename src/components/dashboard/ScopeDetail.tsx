"use client";

import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { Link } from "@/i18n/navigation";
import {
  cardsHref,
  fullSetPrice,
  rarityColor,
  type Block,
  type BlockPick,
  type Extension,
  type Scope,
} from "@/components/dashboard/model";
import { Bar, DataTable, MiniStat, Section } from "@/components/dashboard/ui";
import { progressByRarity } from "@/lib/logic";
import type { Progress } from "@/lib/types";

/** Détail du bloc (ou de l'extension) choisi : compteurs, extensions du bloc et progression par rareté. */
export function ScopeDetail({
  current,
  scope,
  block,
  pickedExtension,
  isSealed,
  hasPrices,
  items,
  setPick,
  pickRow,
}: {
  current: Scope;
  scope: Scope;
  block: Block | null;
  pickedExtension: Extension | null;
  isSealed: boolean;
  hasPrices: boolean;
  items: { printingId: string; quantity: number }[];
  setPick: (pick: BlockPick | null) => void;
  pickRow: (extension: Extension) => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  return (

    <Section
      title={
        <>
          <span className="text-muted">{t("dashboard.detail")} ·</span>{" "}
          <span className="text-yellow">{current.name}</span>
          {pickedExtension ? <span className="text-foreground"> › {pickedExtension.shortName}</span> : null}
        </>
      }
      action={
        <Link
          href={cardsHref({
            set: scope.browseSet,
            language: scope.language,
          })}
          className="border border-line px-3.5 py-2.5 text-sm text-cyan hover:border-cyan hover:text-foreground"
        >
          {isSealed ? t("dashboard.openSealedCategory") : t("dashboard.viewSetCards")} →
        </Link>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
          <div className="hud-panel grid grid-cols-3">
            <MiniStat label={t("dashboard.copies")} value={fmt.int(scope.progress.totalCopies)} />
            <MiniStat
              label={t("dashboard.missing")}
              value={fmt.int(scope.progress.missing)}
              href={cardsHref({
                set: scope.browseSet,
                language: scope.language,
                collection: "missing",
              })}
              tone="danger"
            />
            <MiniStat
              label={t("dashboard.duplicates")}
              value={fmt.int(scope.progress.duplicates)}
              href={cardsHref({
                set: scope.browseSet,
                language: scope.language,
                collection: "duplicates",
              })}
              last
            />
          </div>

          {block ? (
            <div className="hud-panel flex flex-col gap-2 p-5">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em]">
                  {t("dashboard.blockExtensions")}
                </h3>
                {pickedExtension ? (
                  <button
                    type="button"
                    onClick={() => setPick(null)}
                    className="min-h-8 border border-line px-2.5 text-xs text-muted hover:border-cyan hover:text-foreground"
                  >
                    {t("dashboard.wholeBlock")}
                  </button>
                ) : null}
              </div>
              {block.extensions.map((extension) => (
                <PickRow
                  key={extension.key}
                  label={extension.shortName}
                  progress={extension.progress}
                  price={hasPrices ? fullSetPrice(extension.printings) : null}
                  active={pickedExtension?.key === extension.key}
                  openLabel={t("dashboard.openList")}
                  onClick={() => pickRow(extension)}
                />
              ))}
            </div>
          ) : null}
        </div>

        {isSealed ? (
          <SealedProducts extension={scope} items={items} />
        ) : (
          <DataTable minWidth="420px">
            <thead>
              <tr>
                <th>
                  {t("dashboard.byRarity")}
                  {pickedExtension ? <span className="ml-2 text-yellow">· {pickedExtension.shortName}</span> : null}
                </th>
                <th className="w-20 sm:w-32">{t("dashboard.uniques")}</th>
                <th className="w-[45%]">{t("dashboard.progress")}</th>
              </tr>
            </thead>
            <tbody>
              {progressByRarity(scope.printings, scope.ownership).map((row) => {
                const href = cardsHref({
                  set: scope.browseSet,
                  language: scope.language,
                  rarity: row.rarity,
                });
                return (
                  <tr key={row.rarity}>
                    <td className="p-0">
                      <Link
                        href={href}
                        className="flex items-center gap-2 px-2.5 py-3 hover:text-cyan sm:px-4"
                        aria-label={t("dashboard.viewRarity", { rarity: row.rarity })}
                      >
                        <span
                          aria-hidden
                          className="size-2 shrink-0"
                          style={{ background: rarityColor(row.rarity) }}
                        />
                        {row.rarity}
                      </Link>
                    </td>
                    <td className="p-0 font-mono">
                      <Link href={href} tabIndex={-1} aria-hidden className="block px-2.5 py-3 whitespace-nowrap sm:px-4">
                        {fmt.int(row.uniqueOwned)} / {fmt.int(row.total)}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={href} tabIndex={-1} aria-hidden className="flex items-center gap-2 px-2.5 py-3 sm:gap-2.5 sm:px-4">
                        <Bar percent={row.percent} color={rarityColor(row.rarity)} />
                        <span className="w-11 text-right font-mono sm:w-14">{fmt.percent(row.percent)}</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </div>
    </Section>
  );
}

/** Ligne cliquable du bloc : 1er clic sélectionne, 2e clic (ligne active) ouvre les cartes. */
function PickRow({
  label,
  progress,
  price,
  active,
  openLabel,
  onClick,
}: {
  label: string;
  progress: Progress;
  price: ReturnType<typeof fullSetPrice>;
  active: boolean;
  openLabel: string;
  onClick: () => void;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const priceTitle = price
    ? [
        `${t("dashboard.fullSetPrice")} ${t("dashboard.fullSetHint")}`,
        price.priced < price.count ? `${fmt.int(price.priced)} / ${fmt.int(price.count)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;
  return (
    <button
      type="button"
      aria-pressed={active}
      title={active ? openLabel : undefined}
      onClick={onClick}
      className={`group -mx-2 flex min-h-11 items-center gap-2 border px-2 sm:gap-3 text-left transition-colors focus-visible:border-cyan focus-visible:outline-none ${
        active ? "border-yellow/70 bg-panel-2" : "border-transparent hover:border-cyan/50 hover:bg-panel-2"
      }`}
    >
      <span className="flex w-24 shrink-0 flex-col py-1 sm:w-44">
        <span className="truncate font-display text-sm font-semibold uppercase tracking-[0.08em] text-foreground">
          {label}
        </span>
        {price ? (
          <span title={priceTitle} className="truncate font-mono text-xs text-yellow">
            {fmt.money(price.total)}
          </span>
        ) : null}
      </span>
      <Bar percent={progress.percent} tone={active ? "yellow" : "cyan"} thick />
      <span className="w-20 shrink-0 text-right font-mono text-sm text-muted group-hover:text-foreground sm:w-24">
        <span className="text-foreground">{fmt.int(progress.uniqueOwned)}</span> / {fmt.int(progress.total)}
      </span>
      <span
        aria-hidden
        className={`w-4 shrink-0 text-right text-xs text-cyan transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
      >
        →
      </span>
    </button>
  );
}

function SealedProducts({ extension, items }: { extension: Scope; items: { printingId: string; quantity: number }[] }) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  return (
    <DataTable minWidth="520px">
      <thead>
        <tr>
          <th>{t("dashboard.sealedProduct")}</th>
          <th className="w-14 sm:w-28">
            <span className="sm:hidden">{t("investment.qty")}</span>
            <span className="hidden sm:inline">{t("dashboard.copies")}</span>
          </th>
          <th className="w-28 sm:w-32">{t("dashboard.value")}</th>
        </tr>
      </thead>
      <tbody>
        {extension.printings
          .slice()
          .sort((a, b) => (a.localizedName ?? a.setName).localeCompare(b.localizedName ?? b.setName, "fr"))
          .map((printing) => {
            const owned = items
              .filter((item) => item.printingId === printing.id)
              .reduce((sum, item) => sum + item.quantity, 0);
            const unit = printing.marketPrice == null ? null : Number(printing.marketPrice);
            const href = cardsHref({
              set: extension.browseSet,
              language: "en",
              printing: printing.id,
            });
            return (
              <tr key={printing.id}>
                <td className="p-0">
                  <Link href={href} className="block px-2.5 py-3 hover:text-cyan sm:px-4">
                    {printing.localizedName ?? printing.setName}
                  </Link>
                </td>
                <td className="p-0 font-mono">
                  <Link href={href} tabIndex={-1} aria-hidden className="block px-2.5 py-3 sm:px-4">
                    {fmt.int(owned)}
                  </Link>
                </td>
                <td className="p-0 font-mono">
                  <Link href={href} tabIndex={-1} aria-hidden className="block px-2.5 py-3 whitespace-nowrap sm:px-4">
                    {unit == null || Number.isNaN(unit)
                      ? "—"
                      : owned > 0
                        ? fmt.money(unit * owned)
                        : fmt.money(unit)}
                  </Link>
                </td>
              </tr>
            );
          })}
      </tbody>
    </DataTable>
  );
}
