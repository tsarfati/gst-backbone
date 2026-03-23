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
