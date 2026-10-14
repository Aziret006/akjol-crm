"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, controlClass } from "@/components/ui";
import { platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { COMPANY_STATUS_LABEL, PERIOD_LABEL, SUB_STATUS_LABEL, money } from "@/lib/platform/labels";
import type { CompanyStatus } from "@/lib/platform/types";
import { formatDate, formatDateTime } from "@/lib/time";
import { Confirm, EmptyBox, Pager, Pill } from "./widgets";

const PAGE = 8;

export function CompaniesScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const { state, role, run } = usePlatform();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CompanyStatus>("all");
  const [planId, setPlanId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<null | { kind: "status"; status: CompanyStatus } | { kind: "plan"; planId: string }>(null);
  const [message, setMessage] = useState("");
  if (!platformAllows(role, "companies.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;

  const selected = state.companies.find((item) => item.id === id) ?? null;
  if (selected) {
    const owner = state.users.find((item) => item.id === selected.ownerUserId);
    const staff = state.users.filter((item) => item.companyId === selected.id);
    const sub = state.subscriptions.find((item) => item.companyId === selected.id);
    const plan = state.plans.find((item) => item.id === selected.planId);
    const pays = state.payments.filter((item) => item.companyId === selected.id);
    const channels = state.integrations.filter((item) => item.companyId === selected.id);
    const agent = state.agents.find((item) => item.companyId === selected.id);
    const log = state.journal.filter((item) => item.object.includes(selected.name));
    const canEdit = platformAllows(role, "companies.edit");
    return (
      <div className="space-y-3">
        <Link href="/platform/companies" className="text-sm text-[#1d5fa7]">← Все компании</Link>
        {message ? <p className="text-sm text-[#1f7a45]">{message}</p> : null}
        <section className="crm-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{selected.name} <span className="text-sm font-normal text-[#98a2b3]">демо</span></h3>
              <p className="text-sm text-[#667085]">{selected.email} · {selected.phone} · {selected.id}</p>
            </div>
            <Pill text={COMPANY_STATUS_LABEL[selected.status]} tone={selected.status === "active" ? "green" : selected.status === "suspended" ? "rose" : "amber"} />
          </div>
          <p className="mt-2 text-sm">Владелец: {owner?.name ?? "—"} · тариф {plan?.name} · регистрация {formatDateTime(selected.createdAt)}</p>
          {sub ? <p className="mt-1 text-sm text-[#667085]">Подписка: {SUB_STATUS_LABEL[sub.status]} · {formatDate(sub.startedAt)} — {formatDate(sub.endsAt)} · {money(sub.amount)}</p> : null}
          {canEdit ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {selected.status !== "suspended" && selected.status !== "closed" ? <Button variant="danger" onClick={() => setConfirm({ kind: "status", status: "suspended" })}>Приостановить</Button> : null}
              {selected.status === "suspended" || selected.status === "closed" ? <Button onClick={() => setConfirm({ kind: "status", status: "active" })}>Восстановить</Button> : null}
              {selected.status !== "closed" ? <Button variant="secondary" onClick={() => setConfirm({ kind: "status", status: "closed" })}>Закрыть</Button> : null}
              <select className={`${controlClass} w-auto`} defaultValue="" onChange={(event) => { if (event.target.value) setConfirm({ kind: "plan", planId: event.target.value }); event.target.value = ""; }}>
                <option value="">Сменить тариф…</option>
                {state.plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          ) : null}
        </section>
        <section className="crm-panel">
          <h3 className="px-4 py-3 font-semibold">Сотрудники</h3>
          {staff.map((item) => (
            <Link key={item.id} href={`/platform/users?id=${item.id}`} className="flex justify-between border-t border-[#e6e8ec] px-4 py-2 text-sm hover:bg-[#f8fafc]">
              <span>{item.name} · {item.role}</span>
              <span className="text-[#667085]">{item.email}</span>
            </Link>
          ))}
        </section>
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Каналы и AI</h3>
          <p className="mt-2 text-sm">{channels.length ? channels.map((item) => `${item.kind}: ${item.status}`).join(" · ") : "Каналов нет"}</p>
          <p className="mt-1 text-sm text-[#667085]">AI: {agent ? `${agent.name} · ${agent.status}` : "нет карточки"}</p>
        </section>
        <section className="crm-panel">
          <h3 className="px-4 py-3 font-semibold">Платежи</h3>
          {pays.length === 0 ? <EmptyBox>Платежей нет</EmptyBox> : pays.map((item) => (
            <p key={item.id} className="border-t border-[#e6e8ec] px-4 py-2 text-sm">{formatDateTime(item.at)} · {money(item.amount)} · {item.status} · {item.note}</p>
          ))}
        </section>
        <section className="crm-panel">
          <h3 className="px-4 py-3 font-semibold">История действий</h3>
          {log.length === 0 ? <EmptyBox>Записей по этой компании нет</EmptyBox> : log.slice(0, 12).map((item) => (
            <p key={item.id} className="border-t border-[#e6e8ec] px-4 py-2 text-sm">{formatDateTime(item.at)} · {item.action} · {item.reason || item.object}</p>
          ))}
        </section>
        {confirm?.kind === "status" ? (
          <Confirm
            title="Подтвердите изменение доступа"
            text="Компания не удаляется. Закрытие и приостановка обратимы."
            confirmLabel="Подтвердить"
            onClose={() => setConfirm(null)}
            onConfirm={async (reason) => {
              const result = await run({ type: "set-company-status", companyId: selected.id, status: confirm.status, reason });
              setMessage(result.ok ? "Статус сохранён" : result.error);
              setConfirm(null);
            }}
          />
        ) : null}
        {confirm?.kind === "plan" ? (
          <Confirm
            title="Сменить тариф?"
            text="Оплата провайдером не списывается. Меняется только запись в демо-хранилище."
            confirmLabel="Сменить тариф"
            onClose={() => setConfirm(null)}
            onConfirm={async (reason) => {
              const result = await run({ type: "set-company-plan", companyId: selected.id, planId: confirm.planId, reason });
              setMessage(result.ok ? "Тариф обновлён" : result.error);
              setConfirm(null);
            }}
          />
        ) : null}
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const rows = state.companies.filter((item) => {
    if (status !== "all" && item.status !== status) return false;
    if (planId !== "all" && item.planId !== planId) return false;
    const created = item.createdAt.slice(0, 10);
    if (from && created < from) return false;
    if (to && created > to) return false;
    if (needle && !`${item.name} ${item.phone} ${item.email} ${item.id}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className={`${controlClass} max-w-xs`} placeholder="Название, телефон, email, id" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        <select className={`${controlClass} w-auto`} value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
          <option value="all">Все статусы</option>
          {(Object.keys(COMPANY_STATUS_LABEL) as CompanyStatus[]).map((item) => <option key={item} value={item}>{COMPANY_STATUS_LABEL[item]}</option>)}
        </select>
        <select className={`${controlClass} w-auto`} value={planId} onChange={(event) => { setPlanId(event.target.value); setPage(1); }}>
          <option value="all">Все тарифы</option>
          {state.plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input className={`${controlClass} w-auto`} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} aria-label="Регистрация с" />
        <input className={`${controlClass} w-auto`} type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} aria-label="Регистрация по" />
      </div>
      <section className="crm-panel overflow-x-auto">
        {slice.length === 0 ? <EmptyBox>Компаний по этим условиям нет</EmptyBox> : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["Компания", "Контакты", "Статус", "Тариф", "Регистрация"].map((title) => <th key={title} className="px-4 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {slice.map((item) => {
                const plan = state.plans.find((row) => row.id === item.planId);
                return (
                  <tr key={item.id} className="border-t border-[#e6e8ec]">
                    <td className="px-4 py-2"><Link href={`/platform/companies?id=${item.id}`} className="font-medium text-[#1d5fa7]">{item.name}</Link><span className="block text-xs text-[#98a2b3]">{item.id} · демо</span></td>
                    <td className="px-4 py-2">{item.email}<span className="block text-xs text-[#667085]">{item.phone}</span></td>
                    <td className="px-4 py-2"><Pill text={COMPANY_STATUS_LABEL[item.status]} /></td>
                    <td className="px-4 py-2">{plan?.name} · {plan ? PERIOD_LABEL[plan.period] : ""}</td>
                    <td className="px-4 py-2">{formatDate(item.createdAt)}</td>
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
