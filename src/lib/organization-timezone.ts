type DateTimeParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
};

const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const OFFSET_SAMPLE_DAYS = [-2, -1, 0, 1, 2] as const;

function formatter(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = Number(parts.find((item) => item.type === type)?.value);

  return Number.isInteger(value) ? value : null;
}

function partsAt(value: Date, timeZone: string): DateTimeParts | null {
  const dateFormatter = formatter(timeZone);

  if (!dateFormatter || Number.isNaN(value.getTime())) return null;

  const parts = dateFormatter.formatToParts(value);
  const year = part(parts, "year");
  const month = part(parts, "month");
  const day = part(parts, "day");
  const hour = part(parts, "hour");
  const minute = part(parts, "minute");

  if (year === null || month === null || day === null || hour === null || minute === null) {
    return null;
  }

  return { day, hour, minute, month, year };
}

function parseDateTimeLocal(value: string): DateTimeParts | null {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);

  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const parsed = {
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    month: Number(monthText),
    year: Number(yearText),
  };
  const calendarCheck = new Date(Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
  ));

  if (
    calendarCheck.getUTCFullYear() !== parsed.year ||
    calendarCheck.getUTCMonth() + 1 !== parsed.month ||
    calendarCheck.getUTCDate() !== parsed.day ||
    calendarCheck.getUTCHours() !== parsed.hour ||
    calendarCheck.getUTCMinutes() !== parsed.minute
  ) {
    return null;
  }

  return parsed;
}

function sameParts(left: DateTimeParts, right: DateTimeParts) {
  return left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute;
}

function offsetAt(value: Date, timeZone: string) {
  const parts = partsAt(value, timeZone);

  return parts
    ? Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - value.getTime()
    : null;
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function organizationDateTimeLocalToIso(value: string, timeZone: string) {
  const intended = parseDateTimeLocal(value);

  if (!intended || !formatter(timeZone)) return null;

  const utcGuess = Date.UTC(
    intended.year,
    intended.month - 1,
    intended.day,
    intended.hour,
    intended.minute,
  );
  const offsets = new Set<number>();

  for (const dayOffset of OFFSET_SAMPLE_DAYS) {
    const offset = offsetAt(new Date(utcGuess + dayOffset * 86_400_000), timeZone);

    if (offset !== null) offsets.add(offset);
  }

  const matches = [...offsets]
    .map((offset) => new Date(utcGuess - offset))
    .filter((candidate) => {
      const candidateParts = partsAt(candidate, timeZone);

      return candidateParts ? sameParts(candidateParts, intended) : false;
    });

  // A missing wall time (spring transition) has no match. A repeated wall time
  // (autumn transition) has multiple matches. Both require an explicit new choice.
  return matches.length === 1 ? matches[0].toISOString() : null;
}

export function isoToOrganizationDateTimeLocal(value: string, timeZone: string) {
  const parts = partsAt(new Date(value), timeZone);

  return parts
    ? `${parts.year}-${twoDigits(parts.month)}-${twoDigits(parts.day)}T${twoDigits(parts.hour)}:${twoDigits(parts.minute)}`
    : null;
}
