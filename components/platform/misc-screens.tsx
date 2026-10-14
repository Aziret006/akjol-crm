"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, controlClass } from "@/components/ui";
import { PLATFORM_PERMISSIONS, platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { PLATFORM_ROLE_LABEL } from "@/lib/platform/labels";
import type { PlatformRole } from "@/lib/platform/types";
import { formatDateTime } from "@/lib/time";
import { EmptyBox, Pager, Pill } from "./widgets";

export function NoticesScreen() {
  const { state, role, run } = usePlatform();
  const [message, setMessage] = useState("");
  if (!platformAllows(role, "notices.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;
  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-[#1f7a45]">{message}</p> : null}
      <div className="flex justify-end"><Button variant="secondary" onClick={async () => { const result = await run({ type: "read-notice", noticeId: "all" }); setMessage(result.ok ? "Все отмечены прочитанными" : result.error); }}>Отметить все</Button></div>
      <section className="crm-panel">
        {state.notices.length === 0 ? <EmptyBox>Событий нет — фиктивные уведомления не создаются</EmptyBox> : state.notices.map((item) => (
          <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-[#e6e8ec] px-4 py-3 text-sm first:border-t-0">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-[#667085]">{item.category} · {formatDateTime(item.at)} · {item.text}</p>
            </div>
            <div className="flex items-center gap-2">
              <Pill text={item.level} tone={item.level === "critical" ? "rose" : item.level === "warning" ? "amber" : "blue"} />
              {item.read ? null : <Button variant="ghost" className="h-8" onClick={() => void run({ type: "read-notice", noticeId: item.id })}>Прочитано</Button>}
              <Link href={item.href} className="text-[#1d5fa7]">Открыть</Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function JournalScreen() {
  const { state, role } = usePlatform();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  if (!platformAllows(role, "journal.view")) return <EmptyBox>Журнал доступен уполномоченным ролям</EmptyBox>;
  const needle = query.trim().toLowerCase();
  const rows = state.journal.filter((item) => !needle || `${item.action} ${item.object} ${item.actorName}`.toLowerCase().includes(needle));
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const slice = rows.slice((page - 1) * 10, page * 10);
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#667085]">Записи только добавляются. Редактировать журнал из интерфейса нельзя.</p>
      <input className={`${controlClass} max-w-xs`} placeholder="Действие, объект, кто" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
      <section className="crm-panel overflow-x-auto">
        {slice.length === 0 ? <EmptyBox>Записей нет</EmptyBox> : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["Когда", "Кто", "Действие", "Объект", "Результат", "Причина"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {slice.map((item) => (
                <tr key={item.id} className="border-t border-[#e6e8ec]">
                  <td className="px-3 py-2">{formatDateTime(item.at)}</td>
                  <td className="px-3 py-2">{item.actorName}</td>
                  <td className="px-3 py-2">{item.action}</td>
                  <td className="px-3 py-2">{item.object}</td>
                  <td className="px-3 py-2"><Pill text={item.result} tone={item.result === "ok" ? "green" : "rose"} /></td>
                  <td className="px-3 py-2">{item.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={page} pages={pages} onPage={setPage} />
      </section>
    </div>
  );
}

const ROLES: PlatformRole[] = ["owner", "sysadmin", "support", "finance"];

export function RolesScreen() {
  const { state, role } = usePlatform();
  if (!platformAllows(role, "roles.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#667085]">
        Вход в панель — через учётную запись администратора таксопарка. Отдельных логинов «поддержка / финансы» пока нет: в `.data/platform.json` роль владельца назначена `u-admin`. Проверка прав идёт в `/api/platform`, не только скрытием кнопок. Полноценные сессии и CSRF-токены сервера авторизации в проекте не подключены.
      </p>
      <section className="crm-panel">
        <h3 className="px-4 py-3 font-semibold">Операторы</h3>
        {state.operators.map((item) => (
          <p key={item.userId} className="border-t border-[#e6e8ec] px-4 py-2 text-sm">{item.userId} · {PLATFORM_ROLE_LABEL[item.role]}</p>
        ))}
      </section>
      <section className="crm-panel overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#f7f8fa] text-[#667085]">
            <tr>
              <th className="px-3 py-2 font-medium">Право</th>
              {ROLES.map((item) => <th key={item} className="px-3 py-2 font-medium">{PLATFORM_ROLE_LABEL[item]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PLATFORM_PERMISSIONS.map((permission) => (
              <tr key={permission} className="border-t border-[#e6e8ec]">
                <td className="px-3 py-2">{permission}</td>
                {ROLES.map((item) => <td key={item} className="px-3 py-2">{platformAllows(item, permission) ? "да" : "нет"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
