const DEFAULT_COMPANY_TIME_ZONE = "America/New_York";

type DateLike = string | number | Date;

const weekdayIndexMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const getCompanyTimeZone = (timeZone?: string | null) =>
  timeZone && timeZone.trim() ? timeZone : DEFAULT_COMPANY_TIME_ZONE;

export const formatInCompanyTimeZone = (
  value: DateLike,
  timeZone?: string | null,
  options?: Intl.DateTimeFormatOptions,
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: getCompanyTimeZone(timeZone),
    ...options,
  }).format(date);
};

export const formatCompanyDateTime = (value: DateLike, timeZone?: string | null) =>
  formatInCompanyTimeZone(value, timeZone, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const formatCompanyDate = (value: DateLike, timeZone?: string | null) =>
  formatInCompanyTimeZone(value, timeZone, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export const formatCompanyShortDate = (value: DateLike, timeZone?: string | null) =>
  formatInCompanyTimeZone(value, timeZone, {
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const formatCompanyTime = (value: DateLike, timeZone?: string | null) =>
  formatInCompanyTimeZone(value, timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const formatCompanyWeekdayMonthDay = (value: DateLike, timeZone?: string | null) =>
  formatInCompanyTimeZone(value, timeZone, {
    weekday: "short",
    month: "short",
    day: "2-digit",
  });

export const formatCompanyMonthDay = (value: DateLike, timeZone?: string | null) =>
  formatInCompanyTimeZone(value, timeZone, {
    month: "short",
    day: "2-digit",
  });

export const formatCompanyMonthDayYear = (value: DateLike, timeZone?: string | null) =>
  formatInCompanyTimeZone(value, timeZone, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

export const getCompanyDateKey = (value: DateLike, timeZone?: string | null) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getCompanyTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
};

export const getCompanyWeekStartKey = (value: DateLike, timeZone?: string | null) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const tz = getCompanyTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value || "Sun";
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || 1);

  const localMiddayUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  localMiddayUtc.setUTCDate(localMiddayUtc.getUTCDate() - (weekdayIndexMap[weekday] ?? 0));

  const startYear = localMiddayUtc.getUTCFullYear();
  const startMonth = String(localMiddayUtc.getUTCMonth() + 1).padStart(2, "0");
  const startDay = String(localMiddayUtc.getUTCDate()).padStart(2, "0");
  return `${startYear}-${startMonth}-${startDay}`;
};

export const companyDateKeyToDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00Z`);

const getTimeZoneOffsetMinutes = (timeZone: string, date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);

  const offsetToken = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = offsetToken.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
};

export const formatCompanyDateTimeInputValue = (value: DateLike, timeZone?: string | null) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getCompanyTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  return year && month && day && hour && minute
    ? `${year}-${month}-${day}T${hour}:${minute}`
    : "";
};

export const companyInputDateTimeToIso = (value: string, timeZone?: string | null) => {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";

  const [, year, month, day, hour, minute] = match;
  const tz = getCompanyTimeZone(timeZone);

  let utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  let offsetMinutes = getTimeZoneOffsetMinutes(tz, new Date(utcMillis));
  utcMillis -= offsetMinutes * 60 * 1000;

  const refinedOffsetMinutes = getTimeZoneOffsetMinutes(tz, new Date(utcMillis));
  if (refinedOffsetMinutes !== offsetMinutes) {
    utcMillis += offsetMinutes * 60 * 1000;
    utcMillis -= refinedOffsetMinutes * 60 * 1000;
  }

  return new Date(utcMillis).toISOString();
};
