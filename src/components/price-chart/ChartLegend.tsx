import { useTranslations } from "next-intl";
import { INVESTED, LINE, PURCHASE } from "./colors";

type ChartLegendProps = {
  hasInvested: boolean;
  hasPurchases: boolean;
};

export function ChartLegend({ hasInvested, hasPurchases }: ChartLegendProps) {
  const t = useTranslations();
  return (
    <ul className="-mt-3 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-4" style={{ background: LINE }} />
        {t("chart.value")}
      </li>
      {hasInvested ? (
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: INVESTED, opacity: 0.7 }} />
          {t("chart.invested")}
        </li>
      ) : null}
      {hasPurchases ? (
        <li className="flex items-center gap-1.5">
          <span className="size-2 rotate-45" style={{ background: PURCHASE }} />
          {t("chart.purchase")}
        </li>
      ) : null}
    </ul>
  );
}
