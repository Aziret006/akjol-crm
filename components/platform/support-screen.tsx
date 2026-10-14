"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, controlClass } from "@/components/ui";
import { platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { PRIORITY_LABEL, TICKET_STATUS_LABEL } from "@/lib/platform/labels";
import type { TicketPriority, TicketStatus } from "@/lib/platform/types";
import { formatDateTime } from "@/lib/time";
import { EmptyBox, Pager, Pill } from "./widgets";

export function SupportScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const { state, role, run } = usePlatform();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | TicketStatus>("all");
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  if (!platformAllows(role, "support.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;
  const canReply = platformAllows(role, "support.reply");
  const selected = state.tickets.find((item) => item.id === id) ?? null;

  if (selected) {
    const company = state.companies.find((item) => item.id === selected.companyId);
    const user = state.users.find((item) => item.id === selected.userId);
    return (
      <div className="space-y-3">
        <Link href="/platform/support" className="text-sm text-[#1d5fa7]">← Все обращения</Link>
        {message ? <p className="text-sm text-[#1f7a45]">{message}</p> : null}
        <section className="crm-panel p-4">
          <h3 className="text-lg font-semibold">№{selected.number} · {selected.subject}</h3>
          <p className="text-sm text-[#667085]">{company?.name} · {user?.name} · {selected.category}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill text={TICKET_STATUS_LABEL[selected.status]} />
            <Pill text={PRIORITY_LABEL[selected.priority]} tone={selected.priority === "high" ? "rose" : "gray"} />
          </div>
          {canReply ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <select className={`${controlClass} w-auto`} value={selected.status} onChange={(event) => void run({ type: "set-ticket", ticketId: selected.id, status: event.target.value as TicketStatus })}>
                {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((item) => <option key={item} value={item}>{TICKET_STATUS_LABEL[item]}</option>)}
              </select>
              <select className={`${controlClass} w-auto`} value={selected.priority} onChange={(event) => void run({ type: "set-ticket", ticketId: selected.id, priority: event.target.value as TicketPriority })}>
                {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((item) => <option key={item} value={item}>{PRIORITY_LABEL[item]}</option>)}
              </select>
              <input className={`${controlClass} max-w-xs`} placeholder="Ответственный" defaultValue={selected.assignee ?? ""} onBlur={(event) => { const value = event.target.value.trim(); void run({ type: "set-ticket", ticketId: selected.id, assignee: value || null }); }} />
            </div>
          ) : null}
        </section>
        <section className="crm-panel p-4 space-y-3">
          {selected.messages.map((item) => (
            <article key={item.id} className={`rounded-lg p-3 text-sm ${item.staff ? "bg-[#e8f1fb]" : "bg-[#f7f8fa]"}`}>
              <p className="text-xs text-[#667085]">{item.author} · {formatDateTime(item.at)}</p>
              <p className="mt-1">{item.text}</p>
            </article>
          ))}
          {canReply ? (
            <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); const result = await run({ type: "reply-ticket", ticketId: selected.id, text }); setMessage(result.ok ? "Ответ сохранён" : result.error); if (result.ok) setText(""); }}>
              <input className={controlClass} value={text} onChange={(event) => setText(event.target.value)} placeholder="Ответ клиенту" />
              <Button type="submit">Отправить</Button>
            </form>
          ) : null}
        </section>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const rows = state.tickets.filter((item) => {
    if (status !== "all" && item.status !== status) return false;
    const company = state.companies.find((row) => row.id === item.companyId);
    return !needle || `${item.number} ${item.subject} ${company?.name ?? ""}`.toLowerCase().includes(needle);
  });
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const slice = rows.slice((page - 1) * 8, page * 8);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className={`${controlClass} max-w-xs`} placeholder="Номер, тема, компания" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        <select className={`${controlClass} w-auto`} value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
          <option value="all">Все статусы</option>
          {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((item) => <option key={item} value={item}>{TICKET_STATUS_LABEL[item]}</option>)}
        </select>
      </div>
      <section className="crm-panel overflow-x-auto">
        {slice.length === 0 ? <EmptyBox>Обращений нет</EmptyBox> : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["№", "Компания", "Тема", "Категория", "Приоритет", "Статус", "Ответственный", "Создано"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {slice.map((item) => {
                const company = state.companies.find((row) => row.id === item.companyId);
                return (
                  <tr key={item.id} className="border-t border-[#e6e8ec]">
                    <td className="px-3 py-2"><Link className="text-[#1d5fa7]" href={`/platform/support?id=${item.id}`}>№{item.number}</Link></td>
                    <td className="px-3 py-2">{company?.name}</td>
                    <td className="px-3 py-2">{item.subject}</td>
                    <td className="px-3 py-2">{item.category}</td>
                    <td className="px-3 py-2">{PRIORITY_LABEL[item.priority]}</td>
                    <td className="px-3 py-2"><Pill text={TICKET_STATUS_LABEL[item.status]} /></td>
                    <td className="px-3 py-2">{item.assignee ?? "—"}</td>
                    <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
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
