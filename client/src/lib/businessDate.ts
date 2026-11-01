import { BUSINESS_TIME_ZONE } from "../../../shared/const";

const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getDateParts(date: Date) {
  const parts = Object.fromEntries(
    BUSINESS_DATE_FORMATTER.formatToParts(date).map(part => [
      part.type,
      part.value,
    ])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function getBusinessDateInput(date = new Date()) {
  const { year, month, day } = getDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addCalendarDay(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function zonedMidnightAsUtc(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const targetLocalAsUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let timestamp = targetLocalAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .map(part => [part.type, part.value])
    );
    const observedLocalAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const adjustment = targetLocalAsUtc - observedLocalAsUtc;
    if (adjustment === 0) return new Date(timestamp);
    timestamp += adjustment;
  }

  throw new RangeError(
    `Could not resolve local midnight for ${dateInput} in ${BUSINESS_TIME_ZONE}`
  );
}

export function millisecondsUntilNextBusinessMidnight(now = new Date()) {
  const nextDate = addCalendarDay(getBusinessDateInput(now));
  return Math.max(1, zonedMidnightAsUtc(nextDate).getTime() - now.getTime());
}
