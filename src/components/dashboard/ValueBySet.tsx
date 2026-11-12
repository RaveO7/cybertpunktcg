"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useNumberFormat } from "@/i18n/number-format";
import { Link, type Href } from "@/i18n/navigation";
import { TrendBadge } from "@/components/TrendBadge";
import { investmentHref, type ValueRow, type ValueSummary } from "@/components/dashboard/model";
import { Bar, DataTable, EmptyPanel, ProfitText, Section } from "@/components/dashboard/ui";

/** Valeur par extension (par langue), en liste sur téléphone et en tableau sur ordinateur. */
export function ValueBySet({
  isSealed,
  isDesktop,
  valueRows,
  valueTotal,
  globalValue,
}: {
  isSealed: boolean;
  isDesktop: boolean;
  valueRows: ValueRow[];
  valueTotal: number;
  globalValue: ValueSummary | null;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  return (

    <Section
      title={isSealed ? t("dashboard.valueBySealed") : t("dashboard.valueBySet")}
      hint={isSealed ? t("dashboard.valueBySealedHint") : t("dashboard.valueBySetHint")}
      action={
        <Link
          href="/investissement"
          className="border border-cyan px-3.5 py-2.5 text-sm text-cyan hover:text-foreground"
        >
          {t("dashboard.viewInvestment")} →
        </Link>
      }
    >
      {valueRows.length === 0 ? (
        <EmptyPanel>{isSealed ? t("dashboard.emptySealedInvestment") : t("dashboard.emptyInvestment")}</EmptyPanel>
      ) : !isDesktop ? (
        <ul className="hud-panel md:hidden">
          {valueRows.map(({ key, name, language: rowLanguage, set, value: row }) => (
            <ValueItem
              key={key}
              href={set ? investmentHref(set, rowLanguage) : null}
              title={
                <>
                  <span className={name == null ? "text-muted" : "font-medium"}>{name ?? t("dashboard.otherSets")}</span>
                  {rowLanguage ? (
                    <span className="ml-2 text-xs text-muted">
                      {rowLanguage === "fr" ? t("common.french") : t("common.english")}
                    </span>
                  ) : null}
                </>
              }
              value={row}
              // Une seule ligne : la part du total vaut 100 %, inutile de l'afficher.
              share={valueRows.length > 1 && valueTotal > 0 ? (row.marketTotal / valueTotal) * 100 : null}
            />
          ))}
          {globalValue && valueRows.length > 1 ? (
            <ValueItem
              title={<span className="font-display font-semibold uppercase tracking-[0.08em]">{t("dashboard.total")}</span>}
              value={globalValue}
              share={null}
              total
            />
          ) : null}
        </ul>
      ) : (
        <DataTable minWidth="720px" className="hidden md:block">
          <thead>
            <tr>
              <th>{isSealed ? t("dashboard.sealedCategory") : t("dashboard.set")}</th>
              <th className="w-32 text-right">{t("dashboard.copies")}</th>
              <th className="w-32 text-right">{t("dashboard.value")}</th>
              <th className="w-[20%]">{t("dashboard.share")}</th>
              <th className="w-36 text-right">{t("dashboard.marketVar")}</th>
              <th className="w-32 text-right">{t("dashboard.purchasePnL")}</th>
            </tr>
          </thead>
          <tbody>
            {valueRows.map(({ key, name, language: rowLanguage, set, value: row }) => {
              const share = valueTotal > 0 ? (row.marketTotal / valueTotal) * 100 : 0;
              const href = set ? investmentHref(set, rowLanguage) : null;
              return (
                <tr key={key} className={href ? "hover:bg-white/5" : undefined}>
                  <ValueCell href={href} primary className={name == null ? "text-muted" : "font-medium"}>
                    {name ?? t("dashboard.otherSets")}
                    {rowLanguage ? (
                      <span className="ml-2 text-xs font-normal text-muted">
                        {rowLanguage === "fr" ? t("common.french") : t("common.english")}
                      </span>
                    ) : null}
                  </ValueCell>
                  <ValueCell href={href} className="text-right font-mono">
                    {fmt.int(row.pricedCopies)} / {fmt.int(row.copies)}
                  </ValueCell>
                  <ValueCell href={href} className="text-right font-mono">
                    {row.pricedCopies > 0 ? fmt.money(row.marketTotal) : "—"}
                  </ValueCell>
                  <ValueCell href={href}>
                    <span className="flex items-center gap-2.5">
                      <Bar percent={share} tone="cyan" />
                      <span className="w-10 text-right font-mono text-muted">{Math.round(share)} %</span>
                    </span>
                  </ValueCell>
                  <ValueCell href={href} className="text-right">
                    <TrendBadge delta={row.marketDelta} amount={row.marketDeltaAmount} />
                  </ValueCell>
                  <ValueCell href={href} className="text-right font-mono">
                    <ProfitText value={row.profitEur} />
                  </ValueCell>
                </tr>
              );
            })}
          </tbody>
          {globalValue ? (
            <tfoot className="border-t border-[var(--hud-border)]">
              <tr>
                <td className="px-4 py-3 font-display font-semibold uppercase tracking-[0.08em]">
                  {t("dashboard.total")}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {fmt.int(globalValue.pricedCopies)} / {fmt.int(globalValue.copies)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-yellow">{fmt.money(globalValue.marketTotal)}</td>
                <td />
                <td className="px-4 py-3 text-right">
                  <TrendBadge delta={globalValue.marketDelta} amount={globalValue.marketDeltaAmount} />
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  <ProfitText value={globalValue.profitEur} />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </DataTable>
      )}
    </Section>
  );
}

/** Version mobile d'une ligne de « Valeur par extension » : une information par ligne, libellés en clair. */
function ValueItem({
  title,
  value,
  share,
  href = null,
  total = false,
}: {
  title: ReactNode;
  value: ValueSummary;
  share: number | null;
  href?: Href | null;
  total?: boolean;
}) {
  const fmt = useNumberFormat();
  const t = useTranslations();
  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">{title}</span>
        <span className={`shrink-0 font-mono text-base ${total ? "text-yellow" : ""}`}>
          {value.pricedCopies > 0 ? fmt.money(value.marketTotal) : "—"}
        </span>
      </div>
      {share != null ? (
        <div className="mt-2 flex items-center gap-2.5 text-xs">
          <Bar percent={share} tone="cyan" />
          <span className="shrink-0 text-muted">{t("dashboard.valueShare", { percent: `${Math.round(share)} %` })}</span>
        </div>
      ) : null}
      <dl className="mt-2.5 flex flex-col gap-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">{t("dashboard.valuePricedCopies")}</dt>
          <dd className="font-mono">{t("dashboard.valueCount", { count: fmt.int(value.pricedCopies), total: fmt.int(value.copies) })}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">{t("dashboard.valueMarketChange")}</dt>
          <dd>
            <TrendBadge delta={value.marketDelta} amount={value.marketDeltaAmount} />
          </dd>
        </div>
        {value.profitEur != null ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{value.profitEur < 0 ? t("dashboard.valueLoss") : t("dashboard.valueGain")}</dt>
            <dd>
              <ProfitText value={value.profitEur} />
            </dd>
          </div>
        ) : null}
      </dl>
    </>
  );
  const border = total ? "border-t border-[var(--hud-border)]" : "border-t border-line/60 first:border-t-0";
  return href ? (
    <li className={border}>
      <Link href={href} className="block px-4 py-3.5 hover:bg-white/5">
        {content}
      </Link>
    </li>
  ) : (
    <li className={`px-4 py-3.5 ${border}`}>{content}</li>
  );
}

/** Cellule du tableau des valeurs : toute la ligne mène à la page Investissement filtrée. */
function ValueCell({
  href,
  primary = false,
  className = "",
  children,
}: {
  href: Href | null;
  primary?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!href) return <td className={`px-4 py-3 ${className}`}>{children}</td>;
  return (
    <td className={`p-0 ${className}`}>
      <Link
        href={href}
        tabIndex={primary ? undefined : -1}
        aria-hidden={primary ? undefined : true}
        className={`block px-4 py-3 ${primary ? "hover:text-cyan" : ""}`}
      >
        {children}
      </Link>
    </td>
  );
}
