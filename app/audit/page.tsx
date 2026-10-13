"use client";

import { useState } from "react";
import { Empty, NoAccess, controlClass } from "@/components/ui";
import { fullName } from "@/lib/labels";
import { useCrm } from "@/lib/store";
import { formatDateTime } from "@/lib/time";

export default function AuditPage() {
  const crm = useCrm();
  const [actorId, setActorId] = useState("all");
  const [action, setAction] = useState("all");
  if (!crm.isAdmin) return <NoAccess />;
  const actions = [...new Set(crm.state.audit.map((entry) => entry.action))];
  const rows = crm.state.audit.filter((entry) => {
    if (actorId !== "all" && entry.actorId !== actorId) return false;
    if (action !== "all" && entry.action !== action) return false;
    return true;
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#667085]">Журнал только для чтения. Обычные сотрудники не могут его менять.</p>
      <div className="flex flex-wrap gap-2">
        <select className={`${controlClass} w-auto`} value={actorId} onChange={(event) => setActorId(event.target.value)}>
          <option value="all">Все пользователи</option>
          {crm.state.users.map((user) => <option key={user.id} value={user.id}>{fullName(user)}</option>)}
        </select>
        <select className={`${controlClass} w-auto`} value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="all">Все действия</option>
          {actions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <Empty title="Записей нет" text="По фильтру журнал пуст." /> : (
        <div className="overflow-x-auto crm-panel">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>
                {["Когда", "Кто", "Действие", "Объект"].map((title) => <th key={title} className="px-4 py-3 font-medium">{title}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const actor = crm.state.users.find((user) => user.id === entry.actorId);
                return (
                  <tr key={entry.id} className="border-t border-[#e8eaee]">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(entry.at)}</td>
                    <td className="px-4 py-3">{actor ? fullName(actor) : "Система"}</td>
                    <td className="px-4 py-3 font-medium">{entry.action}</td>
                    <td className="px-4 py-3">{entry.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
