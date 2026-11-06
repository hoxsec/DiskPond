import { useBackupHealth } from "@desktop/hooks/queries/use-backup-health";
import { useTheme } from "@desktop/hooks/use-theme";
import { scoreBackupSetup } from "@desktop/lib/backup-health";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { ZVaultType } from "@diskpond/schemas/vault";
import { Card, CardContent } from "@diskpond/ui/card";
import { Skeleton } from "@diskpond/ui/skeleton";
import {
  CheckIcon,
  CircleHelpIcon,
  MinusIcon,
  ShieldCheckIcon,
} from "lucide-react";

type HealthCardProps = {
  isLoading?: boolean;
  vaults?: ZVaultType[];
};

const HEALTH_GAUGE_SEGMENTS = [
  { color: "#ef4444", endDegrees: 224, maxScore: 25, startDegrees: 190 },
  { color: "#f59e0b", endDegrees: 280, maxScore: 50, startDegrees: 240 },
  { color: "#b9e51d", endDegrees: 324, maxScore: 75, startDegrees: 296 },
  { color: "#22c55e", endDegrees: 348, maxScore: 100, startDegrees: 340 },
];

function getNeedleDegrees(score: number) {
  const clampedScore = Math.max(0, Math.min(100, score));
  let minScore = 0;

  for (const segment of HEALTH_GAUGE_SEGMENTS) {
    if (clampedScore <= segment.maxScore) {
      const scoreRange = segment.maxScore - minScore;
      const progress = scoreRange ? (clampedScore - minScore) / scoreRange : 0;

      return (
        segment.startDegrees +
        progress * (segment.endDegrees - segment.startDegrees)
      );
    }

    minScore = segment.maxScore;
  }

  return HEALTH_GAUGE_SEGMENTS.at(-1)?.endDegrees ?? 348;
}

function HealthGauge({ dark, score }: { dark: boolean; score: number | null }) {
  const centerX = 90;
  const centerY = 82;
  const radius = 52;
  const strokeWidth = 9;
  const needleLength = 45;
  const needleRadius = 5;
  const needleCenterY = centerY - needleRadius / 2;
  const angle = (getNeedleDegrees(score ?? 0) * Math.PI) / 180;
  const needleTipX = centerX + Math.cos(angle) * needleLength;
  const needleTipY = needleCenterY + Math.sin(angle) * needleLength;
  const needleLeftX = centerX + Math.cos(angle + Math.PI / 2) * needleRadius;
  const needleLeftY =
    needleCenterY + Math.sin(angle + Math.PI / 2) * needleRadius;
  const needleRightX = centerX + Math.cos(angle - Math.PI / 2) * needleRadius;
  const needleRightY =
    needleCenterY + Math.sin(angle - Math.PI / 2) * needleRadius;
  const pointerColor = dark ? "#fff" : "#000";
  const needlePath = [
    `M ${needleLeftX} ${needleLeftY}`,
    `L ${needleTipX} ${needleTipY}`,
    `L ${needleRightX} ${needleRightY}`,
    "Z",
  ].join(" ");

  const getPoint = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return {
      x: centerX + Math.cos(radians) * radius,
      y: centerY + Math.sin(radians) * radius,
    };
  };

  const arcPath = (startDegrees: number, endDegrees: number) => {
    const start = getPoint(startDegrees);
    const end = getPoint(endDegrees);

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  };

  const segments = HEALTH_GAUGE_SEGMENTS.map((segment) => ({
    color: segment.color,
    path: arcPath(segment.startDegrees, segment.endDegrees),
  }));

  return (
    <svg aria-hidden="true" className="-mb-3 -mt-3 w-44" viewBox="0 0 180 100">
      {segments.map((segment) => (
        <path
          d={segment.path}
          fill="none"
          key={segment.color}
          stroke={score === null ? "var(--border)" : segment.color}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      ))}
      {score !== null ? (
        <>
          <path d={needlePath} fill={pointerColor} />
          <circle
            cx={centerX}
            cy={needleCenterY}
            fill={pointerColor}
            r={needleRadius}
          />
        </>
      ) : null}
    </svg>
  );
}

export function HealthCard({ isLoading, vaults }: HealthCardProps) {
  const { t } = useAppTranslation("vault.overview");
  const { dark } = useTheme();
  const health = useBackupHealth(vaults);
  const {
    sourcesWithIssues,
    isLoading: isHealthLoading,
    isUnavailable,
  } = health;
  const hasNoVaults = vaults?.length === 0;
  const loading = isLoading || isHealthLoading;
  const { score, checks } = scoreBackupSetup(vaults ?? [], health);
  const scoreKey = hasNoVaults
    ? "empty"
    : sourcesWithIssues
      ? "backupErrors"
      : isUnavailable
        ? "unavailable"
        : score === 100
          ? "excellent"
          : score === 75
            ? "good"
            : "improve";

  return (
    <Card className="min-w-0 grow py-0">
      <CardContent className="grid gap-6 p-5 sm:p-6 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-wrap items-center gap-5 sm:flex-nowrap">
          <div className="flex shrink-0 flex-col items-center">
            {!loading ? (
              <>
                <HealthGauge dark={dark} score={hasNoVaults ? null : score} />
                <meter
                  className="sr-only"
                  aria-label={t("score.title")}
                  min={0}
                  max={100}
                  value={score}
                  aria-valuetext={t("score.rating", { score })}
                />
                <p
                  aria-hidden="true"
                  className="flex items-baseline gap-1.5 tabular-nums"
                >
                  <span className="text-3xl font-semibold">{score}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </p>
              </>
            ) : (
              <Skeleton width="10rem" height="7rem" />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ShieldCheckIcon className="size-4" aria-hidden="true" />
              {t("score.title")}
            </p>
            <h2 className="text-2xl font-semibold">
              {!loading ? (
                t(`score.${scoreKey}.category`)
              ) : (
                <Skeleton width={100} />
              )}
            </h2>
            {loading || scoreKey !== "improve" ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {!loading ? (
                  t(`score.${scoreKey}.description`, {
                    count: sourcesWithIssues,
                  })
                ) : (
                  <Skeleton width="90%" count={2} />
                )}
              </p>
            ) : null}
          </div>
        </div>
        <ul className="grid gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-2 @5xl:border-l @5xl:border-t-0 @5xl:pl-6 @5xl:pt-0">
          {checks.map((check) => {
            const color =
              loading || check.passed === null
                ? "text-muted-foreground"
                : check.passed
                  ? "text-success"
                  : "text-orange-700 dark:text-orange-400";
            const detail = check.passed
              ? t("score.passed")
              : t(`score.hints.${check.key}`);
            const Icon =
              check.passed === null
                ? CircleHelpIcon
                : check.passed
                  ? CheckIcon
                  : MinusIcon;
            return (
              <li key={check.key} className="flex items-start gap-2.5">
                <Icon
                  aria-hidden="true"
                  className={`mt-0.5 size-4 shrink-0 ${color}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t(`score.checks.${check.key}`)}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${color}`}
                    title={
                      !loading && check.passed !== null ? detail : undefined
                    }
                  >
                    {loading ? (
                      t("score.checking")
                    ) : check.passed === null ? (
                      t("score.unknown")
                    ) : (
                      <>
                        <span aria-hidden="true">{t("score.points")}</span>
                        <span className="sr-only">
                          {detail}
                          {!check.passed ? ` · ${t("score.points")}` : ""}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
