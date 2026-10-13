"use client";

import Link from "next/link";
import { Empty, RequestBadge } from "@/components/ui";
import { SOURCE_LABEL, fullName } from "@/lib/labels";
import { useCrm } from "@/lib/store";
import { formatDateTime } from "@/lib/time";

export default function RequestsPage() {
  const crm = useCrm();
  if (!crm.user) return null;
  const rows = crm.state.conversations
    .filter((conversation) => conversation.assigneeId === crm.user?.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6b6560]">Только обращения, где ответственны вы.</p>
      {rows.length === 0 ? <Empty title="Обращений нет" text="Когда вам назначат чат, он появится здесь." /> : (
        <div className="overflow-x-auto crm-panel">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-[#faf8f4] text-[#6b6560]">
              <tr>
                {["Клиент", "Источник", "Статус", "Обновлено", ""].map((title) => <th key={title} className="px-4 py-3 font-medium">{title}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((conversation) => {
                const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
                return (
                  <tr key={conversation.id} className="border-t border-[#f3eee6]">
                    <td className="px-4 py-3 font-medium">{customer?.name}</td>
                    <td className="px-4 py-3">{SOURCE_LABEL[conversation.source]}</td>
                    <td className="px-4 py-3"><RequestBadge status={conversation.status} /></td>
                    <td className="px-4 py-3">{formatDateTime(conversation.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <Link className="crm-link" href={`/chats?chat=${conversation.id}`}>Открыть</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {crm.isAdmin ? <p className="text-sm text-[#6b6560]">Администратор {crm.actor ? fullName(crm.actor) : ""} видит здесь только лично назначенные обращения.</p> : null}
    </div>
  );
}
