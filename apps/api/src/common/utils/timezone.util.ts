const BOGOTA_TIMEZONE = 'America/Bogota';
const BOGOTA_OFFSET_MINUTES = -5 * 60;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BOGOTA_OFFSET_MS = BOGOTA_OFFSET_MINUTES * 60 * 1000;

const YMD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const YMD_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

const toBogotaLocalProxy = (utcDate: Date) =>
  new Date(utcDate.getTime() + BOGOTA_OFFSET_MS);

const fromBogotaLocalProxy = (bogotaLocalProxy: Date) =>
  new Date(bogotaLocalProxy.getTime() - BOGOTA_OFFSET_MS);

const parseYmd = (value: string) => {
  const match = value.match(YMD_REGEX);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const proxy = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    proxy.getUTCFullYear() !== year ||
    proxy.getUTCMonth() !== month - 1 ||
    proxy.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
};

export const getBogotaTimezone = () => BOGOTA_TIMEZONE;

export const nowUtc = () => new Date();

export const startOfBogotaDayUtc = (referenceUtc: Date = nowUtc()) => {
  const localProxy = toBogotaLocalProxy(referenceUtc);
  localProxy.setUTCHours(0, 0, 0, 0);
  return fromBogotaLocalProxy(localProxy);
};

export const endOfBogotaDayUtc = (referenceUtc: Date = nowUtc()) => {
  const localProxy = toBogotaLocalProxy(referenceUtc);
  localProxy.setUTCHours(23, 59, 59, 999);
  return fromBogotaLocalProxy(localProxy);
};

export const addBogotaDaysUtc = (referenceUtc: Date, days: number) => {
  const localProxy = toBogotaLocalProxy(referenceUtc);
  localProxy.setUTCDate(localProxy.getUTCDate() + days);
  return fromBogotaLocalProxy(localProxy);
};

export const startOfBogotaWeekUtc = (referenceUtc: Date = nowUtc()) => {
  const localProxy = toBogotaLocalProxy(referenceUtc);
  const day = localProxy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  localProxy.setUTCDate(localProxy.getUTCDate() + diff);
  localProxy.setUTCHours(0, 0, 0, 0);
  return fromBogotaLocalProxy(localProxy);
};

export const endOfBogotaWeekUtc = (referenceUtc: Date = nowUtc()) => {
  const start = startOfBogotaWeekUtc(referenceUtc);
  const startLocalProxy = toBogotaLocalProxy(start);
  startLocalProxy.setUTCDate(startLocalProxy.getUTCDate() + 6);
  startLocalProxy.setUTCHours(23, 59, 59, 999);
  return fromBogotaLocalProxy(startLocalProxy);
};

export const startOfBogotaMonthUtc = (referenceUtc: Date = nowUtc()) => {
  const localProxy = toBogotaLocalProxy(referenceUtc);
  localProxy.setUTCDate(1);
  localProxy.setUTCHours(0, 0, 0, 0);
  return fromBogotaLocalProxy(localProxy);
};

export const endOfBogotaMonthUtc = (referenceUtc: Date = nowUtc()) => {
  const localProxy = toBogotaLocalProxy(referenceUtc);
  localProxy.setUTCMonth(localProxy.getUTCMonth() + 1, 0);
  localProxy.setUTCHours(23, 59, 59, 999);
  return fromBogotaLocalProxy(localProxy);
};

export const startOfPreviousBogotaMonthUtc = (
  referenceUtc: Date = nowUtc(),
) => {
  const localProxy = toBogotaLocalProxy(referenceUtc);
  localProxy.setUTCMonth(localProxy.getUTCMonth() - 1, 1);
  localProxy.setUTCHours(0, 0, 0, 0);
  return fromBogotaLocalProxy(localProxy);
};

export const endOfPreviousBogotaMonthUtc = (referenceUtc: Date = nowUtc()) => {
  const localProxy = toBogotaLocalProxy(referenceUtc);
  localProxy.setUTCDate(0);
  localProxy.setUTCHours(23, 59, 59, 999);
  return fromBogotaLocalProxy(localProxy);
};

export const parseBogotaDateToUtcStart = (value?: string) => {
  if (!value) return null;
  const parsed = parseYmd(value.trim());
  if (!parsed) return null;
  return fromBogotaLocalProxy(
    new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0)),
  );
};

export const parseBogotaDateToUtcEnd = (value?: string) => {
  if (!value) return null;
  const parsed = parseYmd(value.trim());
  if (!parsed) return null;
  return fromBogotaLocalProxy(
    new Date(
      Date.UTC(parsed.year, parsed.month - 1, parsed.day, 23, 59, 59, 999),
    ),
  );
};

export const parseBogotaDateTimeToUtc = (dateYmd: string, timeHm: string) => {
  const parsedDate = parseYmd(dateYmd.trim());
  if (!parsedDate) return null;

  const [hh, mm] = timeHm.trim().split(':').map(Number);
  if (
    !Number.isInteger(hh) ||
    !Number.isInteger(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    return null;
  }

  return fromBogotaLocalProxy(
    new Date(
      Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, hh, mm),
    ),
  );
};

export const parseFlexibleDateTimeToUtc = (
  value?: string,
  options?: { dateOnlyAsBogotaStart?: boolean },
) => {
  if (!value) return null;
  const input = value.trim();
  if (!input) return null;

  const dateOnlyAsBogotaStart = options?.dateOnlyAsBogotaStart ?? true;

  if (YMD_REGEX.test(input)) {
    if (!dateOnlyAsBogotaStart) {
      const parsed = new Date(input);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return parseBogotaDateToUtcStart(input);
  }

  const localDateTimeMatch = input.match(YMD_TIME_REGEX);
  if (localDateTimeMatch && !/[zZ]|[+-]\d{2}:\d{2}$/.test(input)) {
    const year = Number(localDateTimeMatch[1]);
    const month = Number(localDateTimeMatch[2]);
    const day = Number(localDateTimeMatch[3]);
    const hour = Number(localDateTimeMatch[4]);
    const minute = Number(localDateTimeMatch[5]);
    const second = Number(localDateTimeMatch[6] || '0');
    const ms = Number((localDateTimeMatch[7] || '0').padEnd(3, '0'));

    return fromBogotaLocalProxy(
      new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms)),
    );
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getBogotaWeekday = (utcDate: Date) =>
  toBogotaLocalProxy(utcDate).getUTCDay();

export const toBogotaDayBoundsUtc = (dateInput?: string) => {
  if (!dateInput) return undefined;

  const start = parseBogotaDateToUtcStart(dateInput);
  const end = parseBogotaDateToUtcEnd(dateInput);
  if (!start || !end) return undefined;

  return { start, end };
};

export const shiftUtcByDays = (utcDate: Date, days: number) =>
  new Date(utcDate.getTime() + days * ONE_DAY_MS);
