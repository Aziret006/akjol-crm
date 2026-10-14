"use client";

import { useMemo, useState } from "react";
import { Button, controlClass } from "@/components/ui";
import { platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { PAY_STATUS_LABEL, money } from "@/lib/platform/labels";
import type { PaymentStatus } from "@/lib/platform/types";
import { formatDateTime } from "@/lib/time";
import { EmptyBox, Metric, Pager, Pill } from "./widgets";

const PAGE = 8;

export function FinanceScreen() {
  const { state, role } = usePlatform();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.payments.filter((item) => {
      const company = state.companies.find((row) => row.id === item.companyId);
      if (status !== "all" && item.status !== status) return false;
      if (from && item.at.slice(0, 10) < from) return false;
      if (to && item.at.slice(0, 10) > to) return false;
      if (needle && !`${item.id} ${company?.name ?? ""} ${item.providerRef ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    }).sort((a, b) => sort === "amount" ? b.amount - a.amount : b.at.localeCompare(a.at));
  }, [state.payments, state.companies, query, status, from, to, sort]);

  if (!platformAllows(role, "finance.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;

  const paid = rows.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const refunded = rows.filter((item) => item.status === "refunded").reduce((sum, item) => sum + item.amount, 0);
  const byPlan = state.plans.map((plan) => ({
    plan,
    amount: rows.filter((item) => item.planId === plan.id && item.status === "paid").reduce((sum, item) => sum + item.amount, 0),
  })).filter((item) => item.amount > 0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);

  function exportCsv() {
    const header = ["id", "company", "plan", "amount", "currency", "date", "method", "status", "provider", "note"];
    const lines = [header.join(",")].concat(rows.map((item) => {
      const company = state.companies.find((row) => row.id === item.companyId)?.name ?? "";
      const plan = state.plans.find((row) => row.id === item.planId)?.name ?? "";
      return [item.id, csv(company), csv(plan), item.amount, item.currency, item.at, item.method, item.status, item.providerRef ?? "", csv(item.note)].join(",");
    }));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "platform-payments-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#667085]">Платёжный провайдер не подключён. Суммы — демо-записи. Успешное списание не имитируется. Карты и секреты не хранятся.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Оплачено (фильтр)" value={money(paid)} />
        <Metric label="Ожидают" value={rows.filter((item) => item.status === "pending").length} />
        <Metric label="Неуспешные" value={rows.filter((item) => item.status === "failed").length} />
        <Metric label="Возвраты" value={money(refunded)} />
      </div>
      {byPlan.length > 0 ? (
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Доход по тарифам</h3>
          {byPlan.map((item) => <p key={item.plan.id} className="mt-2 text-sm">{item.plan.name}: {money(item.amount)}</p>)}
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input className={`${controlClass} max-w-xs`} placeholder="ID, компания, провайдер" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        <select className={`${controlClass} w-auto`} value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
          <option value="all">Все статусы</option>
          {(Object.keys(PAY_STATUS_LABEL) as PaymentStatus[]).map((item) => <option key={item} value={item}>{PAY_STATUS_LABEL[item]}</option>)}
        </select>
        <input className={`${controlClass} w-auto`} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} aria-label="С даты" />
        <input className={`${controlClass} w-auto`} type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} aria-label="По дату" />
        <select className={`${controlClass} w-auto`} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <option value="date">По дате</option>
          <option value="amount">По сумме</option>
        </select>
        <Button variant="secondary" onClick={exportCsv}>Экспорт CSV</Button>
      </div>
      <section className="crm-panel overflow-x-auto">
        {slice.length === 0 ? <EmptyBox>Транзакций нет</EmptyBox> : (
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["ID", "Компания", "Тариф", "Сумма", "Дата", "Способ", "Статус", "Провайдер"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {slice.map((item) => {
                const company = state.companies.find((row) => row.id === item.companyId);
                const plan = state.plans.find((row) => row.id === item.planId);
                return (
                  <tr key={item.id} className="border-t border-[#e6e8ec]">
                    <td className="px-3 py-2 tabular-nums">{item.id}</td>
                    <td className="px-3 py-2">{company?.name}</td>
                    <td className="px-3 py-2">{plan?.name}</td>
                    <td className="px-3 py-2">{money(item.amount)}</td>
                    <td className="px-3 py-2">{formatDateTime(item.at)}</td>
                    <td className="px-3 py-2">{item.method}</td>
                    <td className="px-3 py-2"><Pill text={PAY_STATUS_LABEL[item.status]} tone={item.status === "paid" ? "green" : item.status === "failed" || item.status === "refunded" ? "rose" : "amber"} /></td>
                    <td className="px-3 py-2">{item.providerRef ?? "нет"}</td>
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

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
