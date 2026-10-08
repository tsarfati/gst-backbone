const DEFAULT_JOB_TIME_ZONE = "America/New_York";

type ShiftSettings = {
  shift_start_time: string | null;
  shift_end_time: string | null;
  count_early_punch_in: boolean | null;
  early_punch_in_grace_minutes: number | null;
  count_late_punch_out: boolean | null;
  late_punch_out_grace_minutes: number | null;
};

type LocalDateParts = { year: number; month: number; day: number };

const localDateParts = (instant: Date, timeZone: string): LocalDateParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
};

const offsetMinutesAt = (instant: Date, timeZone: string) => {
  const token = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(instant).find((part) => part.type === "timeZoneName")?.value;
  const match = token?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Cannot resolve ${timeZone} offset: ${token}`);
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "+" ? minutes : -minutes;
};

const addLocalDays = (parts: LocalDateParts, days: number): LocalDateParts => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

const localShiftTime = (dateParts: LocalDateParts, time: string, timeZone: string) => {
  const { year, month, day } = dateParts;
  const [hours, minutes] = time.split(":").map(Number);
  const wallTimeAsUtc = Date.UTC(year, month - 1, day, hours, minutes);
  let offset = offsetMinutesAt(new Date(wallTimeAsUtc), timeZone);
  let result = new Date(wallTimeAsUtc - offset * 60_000);
  const refinedOffset = offsetMinutesAt(result, timeZone);
  if (refinedOffset !== offset) {
    offset = refinedOffset;
    result = new Date(wallTimeAsUtc - offset * 60_000);
  }
  return result;
};

export function adjustJobShiftTimes(
  punchIn: Date,
  punchOut: Date,
  settings: ShiftSettings,
  timeZone = DEFAULT_JOB_TIME_ZONE,
) {
  if (!settings.shift_start_time || !settings.shift_end_time) {
    return { punchIn, punchOut };
  }

  const shiftDate = localDateParts(punchIn, timeZone);
  const shiftStart = localShiftTime(shiftDate, settings.shift_start_time, timeZone);
  const isOvernight = settings.shift_end_time < settings.shift_start_time;
  const shiftEndDate = isOvernight ? addLocalDays(shiftDate, 1) : shiftDate;
  const shiftEnd = localShiftTime(shiftEndDate, settings.shift_end_time, timeZone);

  let adjustedPunchIn = punchIn;
  let adjustedPunchOut = punchOut;
  const countEarly = settings.count_early_punch_in === true;
  const earlyGrace = settings.early_punch_in_grace_minutes ?? 0;

  if (punchIn < shiftStart) {
    const earliestCountedStart = countEarly
      ? new Date(shiftStart.getTime() - earlyGrace * 60_000)
      : shiftStart;
    if (punchIn < earliestCountedStart || !countEarly) {
      adjustedPunchIn = earliestCountedStart;
    }
  }

  if (punchOut > shiftEnd) {
    const countLate = settings.count_late_punch_out === true;
    const lateGrace = settings.late_punch_out_grace_minutes ?? 0;
    const graceEnd = new Date(shiftEnd.getTime() + lateGrace * 60_000);
    if (!countLate || punchOut < graceEnd) {
      adjustedPunchOut = shiftEnd;
    }
  }

  return { punchIn: adjustedPunchIn, punchOut: adjustedPunchOut };
}
