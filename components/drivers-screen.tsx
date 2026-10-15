"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Modal, controlClass } from "@/components/ui";
import { allows } from "@/lib/access";
import { driverDuty } from "@/lib/orders";
import { DriverCard } from "@/components/driver-card";
import { fullName } from "@/lib/labels";
import {
  DOC_KINDS,
  PIPELINE,
  SOURCE_LEAD_LABEL,
  STAGE_LABEL,
  STOP_LABEL,
  canSeeDriver,
  hasFirstOrder,
  isOverdue,
} from "@/lib/recruitment";
import { useCrm } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import type { Driver, LeadSource, RecruitStage } from "@/lib/types";

export function DriversScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  if (id) return <DriverCard key={id} id={id} />;
  return <DriverList />;
}

function DriverList() {
  const crm = useCrm();
  const router = useRouter();
  const user = crm.user;
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"all" | RecruitStage>("all");
  const [activity, setActivity] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<"active" | "inactive" | "name" | "new">("active");
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", city: "Бишкек", source: "phone" as LeadSource });
  if (!user) return null;
  const viewAll = allows(user.role, "drivers.view_all");
  const needle = query.trim().toLowerCase();
  const visible = crm.state.drivers.filter((driver) => canSeeDriver(driver, user.id, viewAll));
  const matched = visible.filter((driver) => {
    if (mine && driver.ownerId !== user.id) return false;
    if (!needle) return true;
    const owner = crm.state.users.find((item) => item.id === driver.ownerId);
    const haystack = `${driver.firstName} ${driver.lastName} ${driver.phone} ${driver.city} ${driver.plate} ${driver.carModel} ${driver.carColor} ${owner ? fullName(owner) : ""}`.toLowerCase();
    return haystack.includes(needle);
  });
  const rows = matched
    .filter((driver) => stage === "all" || driver.stage === stage)
    .filter((driver) => activity === "all" || lineState(driver) === activity)
    .sort((a, b) => compareDrivers(a, b, sort));
  const activeCount = matched.filter((driver) => lineState(driver) === "active").length;
  const inactiveCount = matched.length - activeCount;
  const tasks = crm.state.driverTasks.filter((task) => !task.doneAt && (viewAll || task.assigneeId === user.id));
  const overdue = tasks.filter((task) => isOverdue(task, crm.now));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Водители</h2>
          <p className="text-sm text-[#667085]">Заявки, которые вы ведёте, и свободная очередь. Чужие закреплённые карточки скрыты.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={crm.readOnly || !allows(user.role, "drivers.edit")}>Новая заявка</Button>
      </div>
      {overdue.length ? <p className="rounded-[10px] bg-[#fdecec] px-3 py-2 text-sm text-[#c24141]">Просроченных задач: {overdue.length}. Push-уведомления не подключены — список только на этом экране.</p> : null}
      <div className="flex flex-wrap gap-2">
        <input className={`${controlClass} min-w-[220px] max-w-sm flex-1`} placeholder="Имя, телефон, город, номер, авто" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Поиск водителя" />
        <select className={`${controlClass} !w-auto`} value={activity} onChange={(event) => setActivity(event.target.value as typeof activity)} aria-label="Активность">
          <option value="all">Все: {matched.length}</option>
          <option value="active">Активные: {activeCount}</option>
          <option value="inactive">Неактивные: {inactiveCount}</option>
        </select>
        <select className={`${controlClass} !w-auto`} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Сортировка">
          <option value="active">Сначала активные</option>
          <option value="inactive">Сначала неактивные</option>
          <option value="name">По имени</option>
          <option value="new">Сначала новые</option>
        </select>
        <select className={`${controlClass} !w-auto`} value={stage} onChange={(event) => setStage(event.target.value as typeof stage)} aria-label="Этап">
          <option value="all">Все этапы</option>
          {PIPELINE.map((item) => <option key={item} value={item}>{STAGE_LABEL[item]}</option>)}
          <option value="stopped">Остановлен</option>
        </select>
        <button type="button" className={`h-9 rounded-lg border px-3 text-sm ${mine ? "border-[#2e6db4] bg-[#e8f1fb]" : "border-[#e6e8ec] bg-white"}`} onClick={() => setMine((value) => !value)}>Только мои</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {PIPELINE.map((item) => (
          <button key={item} type="button" className="crm-panel px-3 py-2 text-left" onClick={() => setStage(item)}>
            <span className="block text-lg font-semibold tabular-nums">{matched.filter((driver) => driver.stage === item).length}</span>
            <span className="text-xs text-[#667085]">{STAGE_LABEL[item]}</span>
          </button>
        ))}
      </div>
      <section className="crm-panel overflow-x-auto">
        {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[#667085]">Водителей по этим условиям нет</p> : (
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["Водитель", "Статус", "Телефон", "Авто", "Этап", "Документы", "Диспетчер"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((driver) => {
                const owner = crm.state.users.find((item) => item.id === driver.ownerId);
                const state = lineState(driver);
                const duty = driverDuty(crm.state.orders, driver);
                const docsReady = DOC_KINDS.filter((kind) => driver.docs[kind] === "verified" || driver.docs[kind] === "received").length;
                const car = [driver.carModel, driver.plate, driver.carColor].filter(Boolean).join(" · ");
                return (
                  <tr key={driver.id} className="border-t border-[#e6e8ec]">
                    <td className="px-3 py-2">
                      <Link href={`/drivers?id=${driver.id}`} className="font-medium text-[#1d5fa7]">{fullName(driver)}</Link>
                      <span className="mt-0.5 block text-xs text-[#667085]">{driver.city || "город не указан"}{driver.demo ? " · демо" : ""}</span>
                    </td>
                    <td className="px-3 py-2">
                      <ActivityPill state={state} busy={duty === "busy"} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{driver.phone}</td>
                    <td className="px-3 py-2">
                      <span className="block">{car || "авто не указано"}</span>
                      <span className="mt-0.5 block text-xs text-[#667085]">{hasFirstOrder(driver, crm.state.orders) ? "1-й заказ есть" : "1-го заказа нет"}</span>
                    </td>
                    <td className="px-3 py-2">{STAGE_LABEL[driver.stage]}{driver.stopReason ? <span className="mt-0.5 block text-xs text-[#667085]">{STOP_LABEL[driver.stopReason]}</span> : null}</td>
                    <td className="px-3 py-2 tabular-nums">{docsReady} / {DOC_KINDS.length}</td>
                    <td className="px-3 py-2">{owner ? fullName(owner) : "очередь"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {tasks.length ? (
        <section className="crm-panel">
          <h3 className="px-4 py-3 font-semibold">Задачи</h3>
          {tasks.map((task) => {
            const driver = crm.state.drivers.find((item) => item.id === task.driverId);
            return (
              <div key={task.id} className="flex items-center justify-between gap-2 border-t border-[#e6e8ec] px-4 py-2 text-sm">
                <span>
                  <span className={isOverdue(task, crm.now) ? "text-[#c24141]" : ""}>{task.title}</span>
                  <span className="mt-0.5 block text-xs text-[#667085]">{driver ? fullName(driver) : "водитель"} · {formatDateTime(task.dueAt)}{task.priority === "high" ? " · высокий" : ""}</span>
                </span>
                <Button className="h-8" variant="secondary" disabled={crm.readOnly} onClick={() => crm.completeDriverTask(task.id)}>Готово</Button>
              </div>
            );
          })}
        </section>
      ) : null}
      {open ? (
        <Modal title="Новая заявка" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            const result = crm.saveLead(form);
            if (!result.ok) { setError(result.error); return; }
            setOpen(false);
            if (result.orderId) router.push(`/drivers?id=${result.orderId}`);
          }}>
            <ErrorText>{error}</ErrorText>
            <Field label="Имя"><input className={controlClass} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></Field>
            <Field label="Фамилия"><input className={controlClass} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></Field>
            <Field label="Телефон"><input className={controlClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></Field>
            <Field label="Город"><input className={controlClass} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
            <Field label="Источник">
              <select className={controlClass} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as LeadSource })}>
                {(Object.keys(SOURCE_LEAD_LABEL) as LeadSource[]).map((item) => <option key={item} value={item}>{SOURCE_LEAD_LABEL[item]}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function lineState(driver: Driver) {
  if (driver.stage === "stopped" || driver.availability === "offline") return "inactive" as const;
  return "active" as const;
}

function compareDrivers(a: Driver, b: Driver, sort: "active" | "inactive" | "name" | "new") {
  if (sort === "name") return fullName(a).localeCompare(fullName(b), "ru");
  if (sort === "new") return b.createdAt.localeCompare(a.createdAt);
  const rank = (driver: Driver) => (lineState(driver) === "active" ? 0 : 1);
  const diff = sort === "inactive" ? rank(b) - rank(a) : rank(a) - rank(b);
  return diff || fullName(a).localeCompare(fullName(b), "ru");
}

function ActivityPill({ state, busy }: { state: "active" | "inactive"; busy: boolean }) {
  const label = state === "inactive" ? "Неактивен" : busy ? "Занят" : "Активен";
  const tone = state === "inactive" ? "bg-[#f4f6f8] text-[#667085]" : busy ? "bg-[#fff4e5] text-[#b45309]" : "bg-[#e7f6ee] text-[#1f7a45]";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}
