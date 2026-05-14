export type TimestampPrecision = "date" | "minute" | "second";

export function getCurrentDateStamp(now = new Date()): string {
  return formatTimestamp(now, "date");
}

export function getCurrentTimestamp(
  precision: TimestampPrecision = "date",
  now = new Date(),
): string {
  return formatTimestamp(now, precision);
}

export function getDatePart(timestamp: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp.trim());
  return match?.[1] ?? null;
}

function formatTimestamp(now: Date, precision: TimestampPrecision): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const date = `${year}-${month}-${day}`;

  if (precision === "date") {
    return date;
  }

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;

  if (precision === "minute") {
    return `${date} ${time}`;
  }

  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${date} ${time}:${seconds}`;
}

export function getIsoWeekParts(now = new Date()): {
  isoYear: number;
  isoWeek: number;
  archiveMonth: string;
} {
  const date = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);

  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const archiveMonth = String(date.getUTCMonth() + 1).padStart(2, "0");

  return { isoYear, isoWeek, archiveMonth };
}
