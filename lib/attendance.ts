import type { AttendanceEvent, AttendanceType, WorkStatus } from "./types";
import { bishkekDateString, formatTime, isoAt } from "./time";

export function eventsForUser(events: AttendanceEvent[], userId: string) {
  return events
    .filter((event) => event.userId === userId)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

export function eventsOnDate(events: AttendanceEvent[], userId: string, date: string) {
  return eventsForUser(events, userId).filter((event) => bishkekDateString(new Date(event.at)) === date);
}

export function openShift(events: AttendanceEvent[], userId: string) {
  const mine = eventsForUser(events, userId);
  if (!mine.length) return null;
  const shiftId = mine[mine.length - 1].shiftId;
  const shiftEvents = mine.filter((event) => event.shiftId === shiftId);
  if (shiftEvents.some((event) => event.type === "finished")) return null;
  return { shiftId, events: shiftEvents };
}

export function currentStatus(events: AttendanceEvent[], userId: string, now = new Date()): WorkStatus {
  const open = openShift(events, userId);
  if (!open) {
    const today = eventsOnDate(events, userId, bishkekDateString(now));
    return today.some((event) => event.type === "finished") ? "finished" : "idle";
  }
  const last = open.events[open.events.length - 1];
  return last.type === "away" ? "away" : "working";
}

export function workedMs(events: AttendanceEvent[], now = Date.now()) {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  let total = 0;
  let openAt: number | null = null;
  for (const event of sorted) {
    const time = new Date(event.at).getTime();
    if (event.type === "arrived" || event.type === "returned") {
      openAt = time;
    } else if ((event.type === "away" || event.type === "finished") && openAt != null) {
      if (time >= openAt) total += time - openAt;
      openAt = null;
    }
  }
  if (openAt != null && now > openAt) total += now - openAt;
  return total;
}

export function awaySpans(events: AttendanceEvent[]) {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const spans: { from: string; to: string | null }[] = [];
  let awayAt: string | null = null;
  for (const event of sorted) {
    if (event.type === "away") awayAt = event.at;
    if (event.type === "returned" && awayAt) {
      spans.push({ from: awayAt, to: event.at });
      awayAt = null;
    }
    if (event.type === "finished" && awayAt) {
      spans.push({ from: awayAt, to: event.at });
      awayAt = null;
    }
  }
  if (awayAt) spans.push({ from: awayAt, to: null });
  return spans;
}

export function formatAwaySpans(events: AttendanceEvent[]) {
  const spans = awaySpans(events);
  if (!spans.length) return "—";
  return spans
    .map((span) => (span.to ? `${formatTime(span.from)}–${formatTime(span.to)}` : `${formatTime(span.from)} — сейчас`))
    .join(", ");
}

export type DaySummary = {
  status: WorkStatus;
  arrivedAt: string | null;
  finishedAt: string | null;
  lastAwayAt: string | null;
  lastReturnAt: string | null;
  awayLabel: string;
  workedMs: number;
  lateMin: number | null;
  events: AttendanceEvent[];
};

export function summarizeDate(
  allEvents: AttendanceEvent[],
  userId: string,
  date: string,
  now = Date.now(),
  scheduleStart: string | null = null,
): DaySummary {
  const events = eventsOnDate(allEvents, userId, date);
  const isToday = date === bishkekDateString(new Date(now));
  const status = isToday ? currentStatus(allEvents, userId, new Date(now)) : statusFromEvents(events);
  const arrivedAt = events.find((event) => event.type === "arrived")?.at ?? null;
  const finishedAt = [...events].reverse().find((event) => event.type === "finished")?.at ?? null;
  const lastAwayAt = [...events].reverse().find((event) => event.type === "away")?.at ?? null;
  const lastReturnAt = [...events].reverse().find((event) => event.type === "returned")?.at ?? null;
  const stillOpen = events.length > 0 && events[events.length - 1].type !== "finished" && events[events.length - 1].type !== "away";
  const cap = !isToday && stillOpen ? new Date(events[events.length - 1].at).getTime() : now;
  let lateMin: number | null = null;
  if (scheduleStart && arrivedAt) {
    const planned = new Date(isoAt(date, scheduleStart)).getTime();
    const delta = new Date(arrivedAt).getTime() - planned;
    lateMin = delta > 60_000 ? Math.floor(delta / 60_000) : 0;
  }
  return {
    status: events.length === 0 && !isToday ? "idle" : status,
    arrivedAt,
    finishedAt,
    lastAwayAt,
    lastReturnAt,
    awayLabel: formatAwaySpans(events),
    workedMs: events.length ? workedMs(events, cap) : 0,
    lateMin,
    events,
  };
}

function statusFromEvents(events: AttendanceEvent[]): WorkStatus {
  if (!events.length) return "idle";
  const last = events[events.length - 1];
  if (last.type === "finished") return "finished";
  if (last.type === "away") return "away";
  return "working";
}

export function canPunch(status: WorkStatus, type: "arrived" | "away" | "finished") {
  if (type === "arrived") return status === "idle" || status === "finished" || status === "away";
  if (type === "away") return status === "working";
  return status === "working" || status === "away";
}

export function nextEventType(status: WorkStatus, type: "arrived" | "away" | "finished"): AttendanceType {
  if (type === "arrived" && status === "away") return "returned";
  return type;
}
