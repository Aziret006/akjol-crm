"use client";

import { useState } from "react";
import { summarizeDate } from "@/lib/attendance";
import { Empty } from "@/components/ui";
import { EVENT_LABEL } from "@/lib/labels";
import { useCrm } from "@/lib/store";
import { datesBetween, formatDate, formatDuration, formatTime, periodBounds } from "@/lib/time";
import type { PeriodKind } from "@/lib/types";

export default function ShiftsPage() {
  const crm = useCrm();
  const [period, setPeriod] = useState<PeriodKind>("week");
  const user = crm.user;
  if (!user) return null;
  const bounds = periodBounds(period, new Date(crm.now));
  const rows = datesBetween(bounds.from, bounds.to)
    .map((day) => ({ day, summary: summarizeDate(crm.state.events, user.id, day, crm.now, user.scheduleStart) }))
    .filter((row) => row.summary.events.length > 0)
    .reverse();

  return (
    <div className="space-y-4">
      <div className="flex rounded-[10px] bg-white p-1 w-fit">
        {(["day", "week", "month"] as PeriodKind[]).map((item) => (
          <button key={item} className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === item ? "bg-[#2e6db4] text-white" : "text-[#525c69]"}`} onClick={() => setPeriod(item)} type="button">
            {item === "day" ? "День" : item === "week" ? "Неделя" : "Месяц"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <Empty title="Смен нет" text="За этот период отметок не найдено." /> : rows.map((row) => (
        <section key={row.day} className="crm-panel">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="font-semibold">{formatDate(row.day)}</h2>
            <p className="text-sm">Чистое время: {formatDuration(row.summary.workedMs)}</p>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {row.summary.events.map((event) => (
                <tr key={event.id} className="border-t border-[#e8eaee]">
                  <td className="px-4 py-2">{EVENT_LABEL[event.type]}</td>
                  <td className="px-4 py-2">{formatTime(event.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
