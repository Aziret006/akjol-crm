"use client";

import { useState } from "react";
import { NoAccess } from "@/components/ui";
import { dispatcherReport, sourceStats } from "@/lib/metrics";
import { useCrm } from "@/lib/store";
import { formatDuration, formatMinutes, periodBounds } from "@/lib/time";
import type { PeriodKind } from "@/lib/types";

export default function AnalyticsPage() {
  const crm = useCrm();
  const [period, setPeriod] = useState<PeriodKind>("week");
  if (!crm.isAdmin) return <NoAccess />;
  const bounds = periodBounds(period, new Date(crm.now));
  const report = dispatcherReport(crm.state, period, crm.now);
  const sources = sourceStats(crm.state, bounds.from, bounds.to);
  const maxWorked = Math.max(...report.map((row) => row.workedMs), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6b6560]">{bounds.label}: {bounds.from} — {bounds.to}. Цифры считаются по сохранённым обращениям и сменам.</p>
        <div className="flex rounded-xl bg-white p-1">
          {(["day", "week", "month"] as PeriodKind[]).map((item) => (
            <button key={item} className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === item ? "bg-[#2e6db4] text-white" : "text-[#525c69]"}`} onClick={() => setPeriod(item)} type="button">
              {item === "day" ? "День" : item === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto crm-panel">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-[#faf8f4] text-[#6b6560]">
            <tr>
              {["Диспетчер", "Закрыто", "В работе", "Входящие", "Первый ответ", "Рабочее время"].map((title) => (
                <th key={title} className="px-4 py-3 font-medium">{title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.map((row) => (
              <tr key={row.user.id} className="border-t border-[#f3eee6]">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3">{row.handled}</td>
                <td className="px-4 py-3">{row.open}</td>
                <td className="px-4 py-3">{row.inbound}</td>
                <td className="px-4 py-3">{formatMinutes(row.avgFirstResponse)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-[#f1eee8]">
                      <div className="h-full bg-[#2e6db4]" style={{ width: `${Math.round((row.workedMs / maxWorked) * 100)}%` }} />
                    </div>
                    {formatDuration(row.workedMs)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="crm-panel p-4">
        <h2 className="font-semibold">Источники за период</h2>
        {sources.length === 0 ? <p className="mt-2 text-sm text-[#6b6560]">Данных нет</p> : (
          <ul className="mt-3 space-y-2">
            {sources.map((source) => (
              <li key={source.source} className="grid grid-cols-[140px_1fr_80px] items-center gap-3 text-sm">
                <span>{source.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[#f1eee8]">
                  <span className="block h-full bg-[#111]" style={{ width: `${source.share}%` }} />
                </span>
                <span>{source.count} · {source.share}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
