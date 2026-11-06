import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Card, CardContent, CardTitle } from "@blinkdisk/ui/card";
import { Skeleton } from "@blinkdisk/ui/skeleton";
import { Sparkline } from "@blinkdisk/ui/sparkline";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import type { ReactNode } from "react";

type VaultStatCardProps = {
  title: string;
  value?: string;
  history?: number[];
  isLoading: boolean;
  description?: string;
  tooltip?: string;
  icon?: ReactNode;
};

export function VaultStatCard({
  title,
  value,
  history,
  isLoading,
  description,
  tooltip,
  icon,
}: VaultStatCardProps) {
  const { language } = useAppTranslation();
  const trend = getHistoryTrend(history);
  const TrendIcon =
    trend.direction === "down"
      ? ArrowDownRightIcon
      : trend.direction === "up"
        ? ArrowUpRightIcon
        : MinusIcon;

  return (
    <Card className="min-w-0 overflow-hidden py-0" title={tooltip}>
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-muted-foreground min-w-0 text-sm font-medium">
            {!isLoading ? title : <Skeleton width={90} />}
          </CardTitle>
          {icon ? (
            <span
              aria-hidden="true"
              className="shrink-0 text-muted-foreground [&>svg]:size-4"
            >
              {icon}
            </span>
          ) : null}
          {!isLoading && history ? (
            <div className="text-foreground flex shrink-0 items-center gap-1 text-xs font-semibold">
              <TrendIcon className="size-4" />
              {formatTrendPercent(trend.percent, language)}
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <p className="min-w-0 break-words text-3xl font-semibold tabular-nums tracking-normal">
            {!isLoading ? value : <Skeleton width={120} />}
          </p>
          {!isLoading && history ? (
            <Sparkline
              className="pointer-events-none h-10 min-w-0 max-w-48 flex-1 text-zinc-400 dark:text-zinc-500"
              values={history ?? []}
            />
          ) : null}
        </div>
        {description ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {!isLoading ? description : <Skeleton width="80%" />}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function getHistoryTrend(history?: number[]) {
  const first = history?.find((value) => value > 0) ?? history?.[0] ?? 0;
  const last = history?.[history.length - 1] ?? 0;
  const percent =
    first === 0 ? (last > 0 ? 100 : 0) : ((last - first) / first) * 100;

  return {
    direction: percent < 0 ? "down" : percent > 0 ? "up" : "flat",
    percent: Math.abs(percent),
  };
}

function formatTrendPercent(percent: number, language: string) {
  return (percent / 100).toLocaleString(language, {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}
