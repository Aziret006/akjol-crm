"use client";

import Link from "next/link";
import { AttendanceControls } from "@/components/attendance-controls";
import { LoginForm } from "@/components/login-form";
import { StatCard, WorkBadge } from "@/components/ui";
import { fullName } from "@/lib/labels";
import { dashboardStats, handledToday, lastMessage } from "@/lib/metrics";
import { useCrm } from "@/lib/store";
import { formatDuration, formatMinutes, formatTime } from "@/lib/time";

export default function HomePage() {
  const crm = useCrm();
  if (!crm.ready) return <p className="text-[#828b95]">Загрузка...</p>;
  if (!crm.user) return <LoginForm />;
  return crm.isAdmin ? <AdminHome /> : <DispatcherHome />;
}

function AdminHome() {
  const crm = useCrm();
  const stats = dashboardStats(crm.state, crm.now);
  const rows = stats.people.filter((item) => item.user.role === "dispatcher");

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Сотрудники" value={String(stats.employees)} />
        <StatCard label="На работе" value={String(stats.working)} />
        <StatCard label="Отошли" value={String(stats.away)} />
        <StatCard label="Смена закрыта" value={String(stats.finished)} />
        <StatCard label="Обращения сегодня" value={String(stats.incoming)} />
        <StatCard label="Сообщения сегодня" value={String(stats.messages)} />
        <StatCard label="Первый ответ" value={formatMinutes(stats.avgResponse)} hint="По новым обращениям за сегодня" />
        <StatCard label="WhatsApp" value={String(stats.connections)} hint="API не подключён" />
      </div>
      <section className="crm-panel px-3 py-2">
        <h2 className="py-1 font-semibold">Источники за сегодня</h2>
        {stats.sources.length === 0 ? <p className="py-2 text-[#828b95]">Сегодня обращений нет</p> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stats.sources.map((source) => (
              <div key={source.source} className="flex items-baseline justify-between border-t border-[#eef1f4] py-1.5">
                <span>{source.label}</span>
                <span className="text-[#828b95]">{source.count} · {source.share}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="crm-panel overflow-x-auto">
        <table className="w-full min-w-[880px] text-left">
          <thead className="bg-[#f7f9fb] text-[#525c69]">
            <tr>
              {["Сотрудник", "Статус", "Начало", "Отход", "Конец", "Время", "Закрыто", ""].map((title) => (
                <th key={title} className="px-3 py-2 font-medium">{title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, summary }) => (
              <tr key={user.id} className="border-t border-[#eef1f4] hover:bg-[#f7fafc]">
                <td className="px-3 py-2">{fullName(user)}</td>
                <td className="px-3 py-2"><WorkBadge status={summary.status} /></td>
                <td className="px-3 py-2">{summary.arrivedAt ? formatTime(summary.arrivedAt) : "—"}</td>
                <td className="px-3 py-2">{summary.lastAwayAt ? formatTime(summary.lastAwayAt) : "—"}</td>
                <td className="px-3 py-2">{summary.finishedAt ? formatTime(summary.finishedAt) : "—"}</td>
                <td className="px-3 py-2">{formatDuration(summary.workedMs)}</td>
                <td className="px-3 py-2">{handledToday(crm.state, user.id, crm.now)}</td>
                <td className="px-3 py-2">
                  <Link className="crm-link" href={`/profile?user=${user.id}`}>Профиль</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DispatcherHome() {
  const crm = useCrm();
  const user = crm.user;
  if (!user) return null;
  const mine = crm.state.conversations.filter((conversation) => conversation.assigneeId === user.id);
  const open = mine.filter((conversation) => conversation.status !== "done");

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <StatCard label="Открытые обращения" value={String(open.length)} />
        <StatCard label="Закрыто сегодня" value={String(handledToday(crm.state, user.id, crm.now))} />
        <StatCard label="Непрочитанные" value={String(mine.reduce((sum, conversation) => sum + conversation.unread, 0))} />
      </div>
      <AttendanceControls userId={user.id} />
      <section className="crm-panel">
        <div className="flex items-center justify-between border-b border-[#eef1f4] px-3 py-2">
          <h2 className="font-semibold">Открытые чаты</h2>
          <Link href="/chats" className="crm-link">Все чаты</Link>
        </div>
        {open.length === 0 ? <p className="px-3 py-3 text-[#828b95]">Открытых обращений нет</p> : open.map((conversation) => {
          const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
          const message = lastMessage(crm.state.messages, conversation.id);
          return (
            <Link key={conversation.id} href={`/chats?chat=${conversation.id}`} className="flex items-center justify-between border-t border-[#eef1f4] px-3 py-2 hover:bg-[#f7fafc]">
              <span>
                <span className="block">{customer?.name}</span>
                <span className="block text-[#828b95]">{message?.text ?? "Нет сообщений"}</span>
              </span>
              <span className="text-xs text-[#828b95]">{message ? formatTime(message.at) : ""}</span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
