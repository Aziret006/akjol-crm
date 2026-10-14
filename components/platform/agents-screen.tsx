"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, controlClass } from "@/components/ui";
import { platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { AGENT_STATUS_LABEL, CHANNEL_LABEL } from "@/lib/platform/labels";
import type { AgentStatus } from "@/lib/platform/types";
import { formatDateTime } from "@/lib/time";
import { Confirm, EmptyBox, Pager, Pill } from "./widgets";

export function AgentsScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const { state, role, run } = usePlatform();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<AgentStatus | null>(null);
  if (!platformAllows(role, "agents.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;
  const selected = state.agents.find((item) => item.id === id) ?? null;
  const canControl = platformAllows(role, "agents.control");

  if (selected) {
    const company = state.companies.find((item) => item.id === selected.companyId);
    const errors = state.agentErrors.filter((item) => item.agentId === selected.id);
    return (
      <div className="space-y-3">
        <Link href="/platform/agents" className="text-sm text-[#1d5fa7]">← Все агенты</Link>
        {message ? <p className="text-sm text-[#b45309]">{message}</p> : null}
        <section className="crm-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold">{selected.name}</h3>
              <p className="text-sm text-[#667085]">{company?.name} · демо-карточка</p>
            </div>
            <Pill text={AGENT_STATUS_LABEL[selected.status]} tone={selected.status === "active" ? "green" : selected.status === "error" ? "rose" : "amber"} />
          </div>
          <p className="mt-2 text-sm">Каналы: {selected.channels.length ? selected.channels.map((item) => CHANNEL_LABEL[item]).join(", ") : "нет"}</p>
          <p className="text-sm">Диалоги: {selected.dialogs} · ошибки: {selected.errors}</p>
          <p className="text-sm">Последняя активность: {selected.lastActiveAt ? formatDateTime(selected.lastActiveAt) : "нет"}</p>
          <p className="mt-2 text-sm text-[#667085]">{selected.configNote}</p>
          <p className="mt-2 text-xs text-[#98a2b3]">API-ключи и секреты клиента скрыты.</p>
          {canControl ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setConfirm("active")}>Перезапустить</Button>
              <Button variant="danger" onClick={() => setConfirm("stopped")}>Остановить</Button>
            </div>
          ) : null}
        </section>
        <section className="crm-panel">
          <h3 className="px-4 py-3 font-semibold">Журнал ошибок</h3>
          {errors.length === 0 ? <EmptyBox>Ошибок нет</EmptyBox> : errors.map((item) => <p key={item.id} className="border-t border-[#e6e8ec] px-4 py-2 text-sm">{formatDateTime(item.at)} · {item.text}</p>)}
        </section>
        {confirm ? (
          <Confirm
            title={confirm === "stopped" ? "Остановить агента?" : "Перезапустить агента?"}
            text="Облачный AI не подключён. Изменится только статус в демо-хранилище."
            confirmLabel="Подтвердить"
            onClose={() => setConfirm(null)}
            onConfirm={async () => {
              const result = await run({ type: "set-agent-status", agentId: selected.id, status: confirm });
              setMessage(result.ok ? "Статус сохранён в демо-хранилище. Облачный AI не подключён." : result.error);
              setConfirm(null);
            }}
          />
        ) : null}
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const rows = state.agents.filter((item) => {
    const company = state.companies.find((row) => row.id === item.companyId);
    return !needle || `${item.name} ${company?.name ?? ""}`.toLowerCase().includes(needle);
  });
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const slice = rows.slice((page - 1) * 8, page * 8);

  return (
    <div className="space-y-3">
      <input className={`${controlClass} max-w-xs`} placeholder="Агент или компания" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
      <section className="crm-panel overflow-x-auto">
        {slice.length === 0 ? <EmptyBox>Агентов нет</EmptyBox> : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["Агент", "Компания", "Статус", "Каналы", "Диалоги", "Ошибки", "Активность"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {slice.map((item) => {
                const company = state.companies.find((row) => row.id === item.companyId);
                return (
                  <tr key={item.id} className="border-t border-[#e6e8ec]">
                    <td className="px-3 py-2"><Link className="text-[#1d5fa7]" href={`/platform/agents?id=${item.id}`}>{item.name}</Link></td>
                    <td className="px-3 py-2">{company?.name}</td>
                    <td className="px-3 py-2"><Pill text={AGENT_STATUS_LABEL[item.status]} /></td>
                    <td className="px-3 py-2">{item.channels.map((row) => CHANNEL_LABEL[row]).join(", ") || "—"}</td>
                    <td className="px-3 py-2">{item.dialogs}</td>
                    <td className="px-3 py-2">{item.errors}</td>
                    <td className="px-3 py-2">{item.lastActiveAt ? formatDateTime(item.lastActiveAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pager page={page} pages={pages} onPage={setPage} />
      </section>
    </div>
  );
}
