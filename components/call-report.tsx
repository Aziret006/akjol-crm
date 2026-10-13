"use client";

import { useState } from "react";
import { fullName } from "@/lib/labels";
import { callReport } from "@/lib/telephony/reports";
import type { TelephonyCall } from "@/lib/telephony/model";
import { overviewBounds, type OverviewRange } from "@/lib/metrics";
import { useCrm } from "@/lib/store";
import { formatMinutes } from "@/lib/time";
import type { User } from "@/lib/types";

const RANGES: { id: OverviewRange; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "yesterday", label: "Вчера" },
  { id: "7", label: "7 дней" },
  { id: "30", label: "30 дней" },
];

export function CallReport({ calls, users }: { calls: TelephonyCall[]; users: User[] }) {
  const crm = useCrm();
  const [range, setRange] = useState<OverviewRange>("7");
  const bounds = overviewBounds(range, crm.now);
  const report = callReport(calls, bounds.from, bounds.to);

  return (
    <section className="crm-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Отчёт по событиям телефонии</h2>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((item) => (
            <button key={item.id} type="button" onClick={() => setRange(item.id)} className={`h-8 rounded-lg px-3 text-sm ${range === item.id ? "bg-[#2e6db4] text-white" : "bg-white text-[#52606d] hover:bg-[#f4f6f8]"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {report.incoming === 0 ? <p className="mt-3 text-sm text-[#667085]">За период событий от провайдера нет. Нулевые цифры ниже не взяты из АТС.</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <p>Входящие: {report.incoming}</p>
        <p>Отвеченные: {report.answered}</p>
        <p>Пропущенные: {report.missed}</p>
        <p>Ожидание: {report.avgWaitMs == null ? "нет отвеченных" : formatMinutes(report.avgWaitMs)}</p>
        <p>Длительность: {report.avgDurationSec == null ? "провайдер не передал" : `${Math.round(report.avgDurationSec)} с`}</p>
        <p>Заказы после звонка: {report.withOrder}</p>
      </div>
      {report.byDispatcher.length === 0 ? null : (
        <ul className="mt-3 space-y-1 text-sm">
          {report.byDispatcher.map((row) => {
            const person = users.find((user) => user.id === row.dispatcherId);
            return <li key={row.dispatcherId || "none"}>{person ? fullName(person) : row.dispatcherId ? row.dispatcherId : "Без диспетчера"}: {row.calls} зв., заказов {row.orders}</li>;
          })}
        </ul>
      )}
    </section>
  );
}
