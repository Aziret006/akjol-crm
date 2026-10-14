"use client";

import Link from "next/link";
import { useState } from "react";
import { platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { COMPANY_STATUS_LABEL, PAY_STATUS_LABEL, money } from "@/lib/platform/labels";
import { useCrm } from "@/lib/store";
import { addDays, bishkekDateString, datesBetween, formatDate, inDateRange } from "@/lib/time";
import { EmptyBox, Metric, Pill, Spark } from "./widgets";

export function DashboardScreen() {
  const crm = useCrm();
  const { state, role } = usePlatform();
  const [range, setRange] = useState<"7" | "30">("30");
  if (!platformAllows(role, "platform.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;
  const today = bishkekDateString(new Date(crm.now));
  const from = range === "7" ? addDays(today, -6) : addDays(today, -29);
  const days = datesBetween(from, today);
  const regs = state.companies.filter((item) => inDateRange(item.createdAt, from, today));
  const paid = state.payments.filter((item) => item.status === "paid" && inDateRange(item.at, from, today));
  const refunds = state.payments.filter((item) => item.status === "refunded" && inDateRange(item.at, from, today));
  const income = paid.reduce((sum, item) => sum + item.amount, 0) - refunds.reduce((sum, item) => sum + item.amount, 0);
  const expiring = state.subscriptions.filter((item) => item.status === "expiring" || (item.endsAt.slice(0, 10) <= addDays(today, 7) && item.endsAt.slice(0, 10) >= today && item.status === "active"));
  const supportOpen = state.tickets.filter((item) => item.status === "new");
  const problems = state.integrations.filter((item) => item.status === "error");
  const chartRegs = days.map((day) => state.companies.filter((item) => bishkekDateString(new Date(item.createdAt)) === day).length);
  const chartSubs = days.map((day) => state.subscriptions.filter((item) => bishkekDateString(new Date(item.startedAt)) === day).length);
  const chartPay = days.map((day) => state.payments.filter((item) => item.status === "paid" && bishkekDateString(new Date(item.at)) === day).length);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex rounded-[10px] bg-white p-1">
          {(["7", "30"] as const).map((item) => (
            <button key={item} type="button" className={`rounded-lg px-3 py-1.5 text-sm ${range === item ? "bg-[#2e6db4] text-white" : "text-[#52606d]"}`} onClick={() => setRange(item)}>
              {item === "7" ? "7 дней" : "30 дней"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Компаний" value={state.companies.length} hint="все демо-арендаторы" />
        <Metric label="Активные" value={state.companies.filter((item) => item.status === "active").length} />
        <Metric label="Новые за период" value={regs.length} />
        <Metric label="Пробный период" value={state.companies.filter((item) => item.status === "trial").length} />
        <Metric label="Платные активные" value={state.subscriptions.filter((item) => item.status === "active" && item.paid).length} />
        <Metric label="Скоро истекают" value={expiring.length} />
        <Metric label="Платежи за период" value={money(income)} hint="оплаченные минус возвраты, демо-записи" />
        <Metric label="AI-агенты" value={state.agents.filter((item) => item.status === "active").length} hint={`из ${state.agents.length} карточек`} />
        <Metric label="Рабочие интеграции" value={state.integrations.filter((item) => item.status === "connected").length} hint="провайдеры не подключены" />
        <Metric label="Поддержка ждёт ответа" value={supportOpen.length} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Spark values={chartRegs} label="Регистрации" />
        <Spark values={chartSubs} label="Новые подписки" />
        <Spark values={chartPay} label="Подтверждённые оплаты" />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <List title="Последние компании" href="/platform/companies">
          {state.companies.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((item) => (
            <Link key={item.id} href={`/platform/companies?id=${item.id}`} className="flex items-center justify-between gap-2 border-t border-[#e6e8ec] px-4 py-2.5 text-sm hover:bg-[#f8fafc]">
              <span>{item.name} <span className="text-[#98a2b3]">демо</span></span>
              <span className="flex items-center gap-2 text-xs text-[#667085]"><Pill text={COMPANY_STATUS_LABEL[item.status]} />{formatDate(item.createdAt)}</span>
            </Link>
          ))}
        </List>
        <List title="Недавние платежи" href="/platform/finance">
          {state.payments.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((item) => {
            const company = state.companies.find((row) => row.id === item.companyId);
            return (
              <div key={item.id} className="flex items-center justify-between gap-2 border-t border-[#e6e8ec] px-4 py-2.5 text-sm">
                <span>{company?.name} · {money(item.amount)}</span>
                <span className="flex items-center gap-2 text-xs"><Pill text={PAY_STATUS_LABEL[item.status]} tone={item.status === "paid" ? "green" : item.status === "failed" ? "rose" : "amber"} />{formatDate(item.at)}</span>
              </div>
            );
          })}
        </List>
        <List title="Проблемы подключений" href="/platform/integrations">
          {problems.length === 0 ? <EmptyBox>Ошибок интеграций нет</EmptyBox> : problems.map((item) => {
            const company = state.companies.find((row) => row.id === item.companyId);
            return (
              <div key={item.id} className="border-t border-[#e6e8ec] px-4 py-2.5 text-sm">
                <p>{company?.name} · {item.kind}</p>
                <p className="text-xs text-[#b45309]">{item.lastError}</p>
              </div>
            );
          })}
        </List>
        <List title="Обращения" href="/platform/support">
          {state.tickets.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((item) => (
            <Link key={item.id} href={`/platform/support?id=${item.id}`} className="flex justify-between gap-2 border-t border-[#e6e8ec] px-4 py-2.5 text-sm hover:bg-[#f8fafc]">
              <span>№{item.number} · {item.subject}</span>
              <span className="text-xs text-[#667085]">{formatDate(item.createdAt)}</span>
            </Link>
          ))}
        </List>
      </div>
      <List title="События, требующие внимания" href="/platform/notices">
        {state.notices.filter((item) => !item.read).length === 0 ? <EmptyBox>Необработанных событий нет</EmptyBox> : state.notices.filter((item) => !item.read).map((item) => (
          <Link key={item.id} href={item.href} className="block border-t border-[#e6e8ec] px-4 py-2.5 text-sm hover:bg-[#f8fafc]">
            <span className="font-medium">{item.title}</span>
            <span className="mt-0.5 block text-xs text-[#667085]">{item.text}</span>
          </Link>
        ))}
      </List>
    </div>
  );
}

function List({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="crm-panel">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        <Link href={href} className="text-xs text-[#1d5fa7]">Все</Link>
      </div>
      {children}
    </section>
  );
}
