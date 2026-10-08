import assert from "node:assert/strict";
import test from "node:test";
import { adjustJobShiftTimes } from "../_shared/shiftTime.ts";

const settings = {
  shift_start_time: "07:00:00",
  shift_end_time: "15:30:00",
  count_early_punch_in: false,
  early_punch_in_grace_minutes: 60,
  count_late_punch_out: false,
  late_punch_out_grace_minutes: 0,
};

test("uses daylight time for a September early punch", () => {
  const result = adjustJobShiftTimes(
    new Date("2026-09-14T10:55:00Z"),
    new Date("2026-09-14T20:00:00Z"),
    settings,
  );
  assert.equal(result.punchIn.toISOString(), "2026-09-14T11:00:00.000Z");
  assert.equal(result.punchOut.toISOString(), "2026-09-14T19:30:00.000Z");
});

test("uses standard time for a January early punch", () => {
  const result = adjustJobShiftTimes(
    new Date("2026-01-14T11:55:00Z"),
    new Date("2026-01-14T21:00:00Z"),
    settings,
  );
  assert.equal(result.punchIn.toISOString(), "2026-01-14T12:00:00.000Z");
  assert.equal(result.punchOut.toISOString(), "2026-01-14T20:30:00.000Z");
});

test("preserves a genuinely late arrival", () => {
  const result = adjustJobShiftTimes(
    new Date("2026-09-12T11:59:00Z"),
    new Date("2026-09-12T19:00:00Z"),
    settings,
  );
  assert.equal(result.punchIn.toISOString(), "2026-09-12T11:59:00.000Z");
  assert.equal(result.punchOut.toISOString(), "2026-09-12T19:00:00.000Z");
});

test("uses the configured company time zone", () => {
  const result = adjustJobShiftTimes(
    new Date("2026-09-14T11:55:00Z"),
    new Date("2026-09-14T21:00:00Z"),
    settings,
    "America/Chicago",
  );
  assert.equal(result.punchIn.toISOString(), "2026-09-14T12:00:00.000Z");
  assert.equal(result.punchOut.toISOString(), "2026-09-14T20:30:00.000Z");
});

test("handles overnight shifts on the next local date", () => {
  const overnightSettings = {
    ...settings,
    shift_start_time: "22:00:00",
    shift_end_time: "06:00:00",
  };
  const result = adjustJobShiftTimes(
    new Date("2026-09-14T01:55:00Z"),
    new Date("2026-09-14T11:00:00Z"),
    overnightSettings,
  );
  assert.equal(result.punchIn.toISOString(), "2026-09-14T02:00:00.000Z");
  assert.equal(result.punchOut.toISOString(), "2026-09-14T10:00:00.000Z");
});
