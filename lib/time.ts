export const TZ = "Asia/Bishkek";

export function bishkekDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isoAt(date: string, time: string) {
  return new Date(`${date}T${time}:00+06:00`).toISOString();
}

export function isoFromDateTimeLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return new Date(`${value}:00+06:00`).toISOString();
}

export function toDateTimeLocal(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(isoOrDate: string) {
  const date = isoOrDate.length === 10 ? new Date(`${isoOrDate}T12:00:00+06:00`) : new Date(isoOrDate);
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(ms: number) {
  const safe = Math.max(0, ms);
  const totalMin = Math.floor(safe / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${hours} ч ${String(minutes).padStart(2, "0")} мин`;
}

export function formatMinutes(ms: number | null) {
  if (ms == null) return "—";
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} мин`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

export function inDateRange(iso: string, from: string, to: string) {
  const day = bishkekDateString(new Date(iso));
  return day >= from && day <= to;
}

export function periodBounds(kind: "day" | "week" | "month", now = new Date()) {
  const today = bishkekDateString(now);
  if (kind === "day") {
    return {
      from: today,
      to: today,
      prevFrom: addDays(today, -1),
      prevTo: addDays(today, -1),
      label: "Сегодня",
    };
  }
  if (kind === "week") {
    return {
      from: addDays(today, -6),
      to: today,
      prevFrom: addDays(today, -13),
      prevTo: addDays(today, -7),
      label: "7 дней",
    };
  }
  return {
    from: addDays(today, -29),
    to: today,
    prevFrom: addDays(today, -59),
    prevTo: addDays(today, -30),
    label: "30 дней",
  };
}

export function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
