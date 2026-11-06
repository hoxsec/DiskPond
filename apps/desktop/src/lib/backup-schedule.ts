import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import { CronExpressionParser } from "cron-parser";

// Allow the engine's scheduling loop to start a due backup before flagging it.
const SCHEDULE_GRACE_MS = 60_000;

export function inspectBackupSchedule(
  source: CoreSourceItem,
  lastSuccess: number,
  now: number,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const schedule = source.schedule;
  if (!schedule) return { kind: "unknown" as const };
  if (schedule.manual || source.status === "REMOTE")
    return { kind: "manual" as const };

  const due: number[] = [];
  let unknown = false;
  if (schedule.intervalSeconds) {
    const interval = schedule.intervalSeconds * 1000;
    if (interval > 0 && Number.isFinite(interval)) {
      // Kopia aligns intervals to Go's zero time (0001-01-01), not wall-clock
      // time of day. Count the latest completed run even if it saved no manifest.
      const goEpochOffset = 62_135_596_800_000;
      due.push(
        Math.floor((lastSuccess + goEpochOffset + interval) / interval) *
          interval -
          goEpochOffset,
      );
    } else unknown = true;
  }
  for (const time of schedule.timeOfDay ?? []) {
    if (
      !Number.isInteger(time.hour) ||
      !Number.isInteger(time.min) ||
      time.hour < 0 ||
      time.hour > 23 ||
      time.min < 0 ||
      time.min > 59
    ) {
      unknown = true;
      continue;
    }
    try {
      due.push(
        CronExpressionParser.parse(`${time.min} ${time.hour} * * *`, {
          currentDate: lastSuccess,
          tz: timeZone,
        })
          .next()
          .getTime(),
      );
    } catch {
      unknown = true;
    }
  }
  for (const value of schedule.cron ?? []) {
    // Match the engine's comment stripping. Its 6/7-field year syntax differs
    // from cron-parser's optional seconds; don't silently reinterpret it.
    const expression = value.split("#")[0]?.trim();
    if (!expression) continue;
    if (!expression.startsWith("@") && expression.split(/\s+/).length !== 5) {
      unknown = true;
      continue;
    }
    try {
      due.push(
        CronExpressionParser.parse(expression, {
          currentDate: lastSuccess,
          tz: timeZone,
        })
          .next()
          .getTime(),
      );
    } catch {
      unknown = true;
    }
  }
  const engineNext = Date.parse(source.nextSnapshotTime ?? "");
  if (
    due.some((time) => time + SCHEDULE_GRACE_MS < now) ||
    (Number.isFinite(engineNext) && engineNext + SCHEDULE_GRACE_MS < now)
  )
    return { kind: "overdue" as const };
  if (unknown) return { kind: "unknown" as const };
  if (!due.length) return { kind: "manual" as const };
  return { kind: "current" as const };
}
