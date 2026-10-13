"use client";

import { useState } from "react";
import { SOURCE_LABEL, fullName } from "@/lib/labels";
import { sourceStats } from "@/lib/metrics";
import { useCrm } from "@/lib/store";
import { formatDateTime, inDateRange, periodBounds } from "@/lib/time";
import type { PeriodKind } from "@/lib/types";
import { Empty, NoAccess, RequestBadge, StatCard } from "@/components/ui";

export default function SourcesPage() {
  const crm = useCrm();
  const [period, setPeriod] = useState<PeriodKind>("week");
  if (!crm.isAdmin) return <NoAccess />;
  const bounds = periodBounds(period, new Date(crm.now));
  const current = sourceStats(crm.state, bounds.from, bounds.to);
  const previous = sourceStats(crm.state, bounds.prevFrom, bounds.prevTo);
  const rows = crm.state.conversations
    .filter((conversation) => inDateRange(conversation.createdAt, bounds.from, bounds.to))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4">
      <div className="flex rounded-[10px] bg-white p-1 w-fit">
        {(["day", "week", "month"] as PeriodKind[]).map((item) => (
          <button key={item} className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === item ? "bg-[#2e6db4] text-white" : "text-[#525c69]"}`} onClick={() => setPeriod(item)} type="button">
            {item === "day" ? "День" : item === "week" ? "Неделя" : "Месяц"}
          </button>
        ))}
      </div>
      <p className="text-sm text-[#667085]">Источник берётся из канала или метки. Если данных нет, стоит «Не определён». Рекламная кампания не подставляется к WhatsApp без метки.</p>
      {current.length === 0 ? <Empty title="Обращений нет" text="За этот период источники не зафиксированы." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {current.map((row) => {
            const prev = previous.find((item) => item.source === row.source)?.count ?? 0;
            const delta = row.count - prev;
            return (
              <article key={row.source} className="crm-panel p-4">
                <p className="text-sm text-[#667085]">{row.label}</p>
                <p className="mt-1 text-3xl font-semibold">{row.count}</p>
                <p className="text-sm text-[#667085]">{row.share}% всех обращений · к прошлому периоду {delta > 0 ? `+${delta}` : delta}</p>
                <p className="mt-2 text-sm">Обработано: {row.processed}</p>
                <p className="text-sm">Без ответа: {row.unanswered}</p>
              </article>
            );
          })}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Всего за период" value={String(rows.length)} />
        <StatCard label="Без ответа" value={String(current.reduce((sum, row) => sum + row.unanswered, 0))} />
        <StatCard label="Не определён" value={String(current.find((row) => row.source === "unknown")?.count ?? 0)} />
      </div>
      <div className="overflow-x-auto crm-panel">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#f7f8fa] text-[#667085]">
            <tr>
              {["Когда", "Клиент", "Источник", "Диспетчер", "Статус", "Первое сообщение"].map((title) => (
                <th key={title} className="px-4 py-3 font-medium">{title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((conversation) => {
              const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
              const assignee = crm.state.users.find((item) => item.id === conversation.assigneeId);
              const first = crm.state.messages.filter((message) => message.conversationId === conversation.id).sort((a, b) => a.at.localeCompare(b.at))[0];
              return (
                <tr key={conversation.id} className="border-t border-[#e8eaee]">
                  <td className="px-4 py-3">{formatDateTime(conversation.createdAt)}</td>
                  <td className="px-4 py-3">{customer?.name}</td>
                  <td className="px-4 py-3">{SOURCE_LABEL[conversation.source]}{conversation.sourceDetail ? ` · ${conversation.sourceDetail}` : ""}</td>
                  <td className="px-4 py-3">{assignee ? fullName(assignee) : "Не назначен"}</td>
                  <td className="px-4 py-3"><RequestBadge status={conversation.status} /></td>
                  <td className="px-4 py-3">{first?.text ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
