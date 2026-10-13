import { inDateRange } from "../time";
import type { TelephonyCall } from "./model";

export function callReport(calls: TelephonyCall[], from: string, to: string) {
  const rows = calls.filter((call) => inDateRange(call.arrivedAt, from, to));
  const answered = rows.filter((call) => call.result === "answered" && call.answeredAt);
  const waits = answered
    .map((call) => new Date(call.answeredAt ?? "").getTime() - new Date(call.arrivedAt).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0);
  const durations = rows.map((call) => call.durationSec).filter((value): value is number => value != null);
  const byDispatcher = new Map<string, { calls: number; answered: number; missed: number; orders: number }>();
  for (const call of rows) {
    const key = call.dispatcherId ?? "";
    const row = byDispatcher.get(key) ?? { calls: 0, answered: 0, missed: 0, orders: 0 };
    row.calls += 1;
    if (call.result === "answered") row.answered += 1;
    if (call.result === "missed") row.missed += 1;
    if (call.orderId) row.orders += 1;
    byDispatcher.set(key, row);
  }
  return {
    incoming: rows.length,
    answered: rows.filter((call) => call.result === "answered").length,
    missed: rows.filter((call) => call.result === "missed").length,
    avgWaitMs: waits.length ? waits.reduce((sum, value) => sum + value, 0) / waits.length : null,
    avgDurationSec: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    withOrder: rows.filter((call) => call.orderId).length,
    byDispatcher: [...byDispatcher.entries()].map(([dispatcherId, row]) => ({ dispatcherId, ...row })),
  };
}
