import { CronExpressionParser } from "cron-parser";

export function getNextRunAt(
  cron: string,
  timezone: string,
  currentDate = new Date(),
) {
  try {
    return CronExpressionParser.parse(cron, {
      currentDate,
      tz: timezone,
    })
      .next()
      .toDate();
  } catch {
    throw new Error("Cron 表达式或时区无效");
  }
}
