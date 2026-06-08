import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const TIMEZONE = "America/Bogota";
const DEFAULT_LOCALE = "es-CO";
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HM_REGEX = /^\d{2}:\d{2}$/;

export function getZonedDate(date: Date | string = new Date()) {
  return typeof date === "string" ? toZonedTime(new Date(date), TIMEZONE) : toZonedTime(date, TIMEZONE);
}

export function toBogotaYmd(date: Date = new Date()) {
  return format(toZonedTime(date, TIMEZONE), "yyyy-MM-dd");
}

export function utcIsoToBogotaYmd(iso: string) {
  return format(toZonedTime(new Date(iso), TIMEZONE), "yyyy-MM-dd");
}

export function utcIsoToBogotaHm(iso: string) {
  return format(toZonedTime(new Date(iso), TIMEZONE), "HH:mm");
}

export function bogotaDateToUtcIso(dateYmd: string) {
  if (!YMD_REGEX.test(dateYmd)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
  return fromZonedTime(`${dateYmd}T00:00:00`, TIMEZONE).toISOString();
}

export function bogotaDateTimeToUtcIso(dateYmd: string, timeHm: string) {
  if (!YMD_REGEX.test(dateYmd)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
  if (!HM_REGEX.test(timeHm)) {
    throw new Error("Invalid time format. Expected HH:mm");
  }
  return fromZonedTime(`${dateYmd}T${timeHm}:00`, TIMEZONE).toISOString();
}

export function ymdToPickerDate(dateYmd: string) {
  if (!YMD_REGEX.test(dateYmd)) return undefined;
  const [year, month, day] = dateYmd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function pickerDateToYmd(date?: Date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToYmd(dateYmd: string, days: number) {
  if (!YMD_REGEX.test(dateYmd)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
  const [year, month, day] = dateYmd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return pickerDateToYmd(date);
}

export function startOfBogotaWeekYmd(dateYmd: string) {
  if (!YMD_REGEX.test(dateYmd)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
  const [year, month, day] = dateYmd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setDate(date.getDate() + diffToMonday);
  return pickerDateToYmd(date);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDashboardDate(date: Date | string) {
  return format(getZonedDate(date), "dd MMM, yyyy");
}

export function formatBogotaDate(
  value: Date | string,
  locale: string = DEFAULT_LOCALE,
) {
  return new Date(value).toLocaleDateString(locale, { timeZone: TIMEZONE });
}

export function formatBogotaTime(
  value: Date | string,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
) {
  return new Date(value).toLocaleTimeString(locale, {
    ...options,
    timeZone: TIMEZONE,
  });
}

export function formatBogotaDateTime(
  value: Date | string,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Date(value).toLocaleString(locale, {
    ...options,
    timeZone: TIMEZONE,
  });
}

export function getMonthBoundaries(monthsAgo = 0) {
  const date = subMonths(new Date(), monthsAgo);
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}
