import assert from "node:assert/strict";
import test from "node:test";
import { getNextRunAt } from "./schedules";

test("calculates the next run in the configured timezone", () => {
  const next = getNextRunAt(
    "0 8 * * *",
    "Asia/Shanghai",
    new Date("2026-08-27T01:00:00.000Z"),
  );

  assert.equal(next.toISOString(), "2026-08-28T00:00:00.000Z");
});

test("rejects invalid schedules", () => {
  assert.throws(() => getNextRunAt("invalid", "Asia/Shanghai"));
  assert.throws(() => getNextRunAt("0 8 * * *", "Unknown/Timezone"));
});
