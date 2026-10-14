"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CallPanel } from "@/components/call-panel";
import { OrderForm } from "@/components/order-form";
import { Button, ErrorText, Modal, controlClass } from "@/components/ui";
import { canPunch, currentStatus, openShift, summarizeDate, workedMs } from "@/lib/attendance";
import { DRIVER_DUTY_LABEL, NEXT_STATUS_LABEL, ORDER_HOLD_LABEL, ORDER_STATUS_LABEL, WORK_LABEL, fullName } from "@/lib/labels";
import { FUNNEL, NEXT_STATUS, canSeeOrder, driverDuty, ordersNeedingAttention } from "@/lib/orders";
import { useCrm } from "@/lib/store";
import { useTelephony } from "@/lib/telephony/client";
import { bishkekDateString, formatDate, formatDuration, formatTime } from "@/lib/time";
import type { Order, OrderStatus } from "@/lib/types";

const TRIP: OrderStatus[] = ["assigned", "en_route", "in_progress"];
const INTAKE: OrderStatus[] = ["new", "processing"];
const OPEN: OrderStatus[] = ["new", "processing", "awaiting_driver", "assigned", "en_route", "in_progress"];
const HOURS = Array.from({ length: 13 }, (_, index) => index + 8);
const STAGE_COLOR: Record<Exclude<OrderStatus, "done" | "cancelled">, string> = {
  new: "#2563eb",
  processing: "#1d4ed8",
  awaiting_driver: "#0284c7",
  assigned: "#0f9d8a",
  en_route: "#16a34a",
  in_progress: "#15803d",
};
const STAGE_HINT: Record<Exclude<OrderStatus, "done" | "cancelled">, string> = {
  new: "принять",
  processing: "уточнить",
  awaiting_driver: "назначить",
  assigned: "выехал",
  en_route: "к клиенту",
  in_progress: "в поездке",
};

type Tab = "all" | "new" | "attention" | "trips";

export function DispatchDesk() {
  const crm = useCrm();
  const telephony = useTelephony();
  const user = crm.user;
  const [form, setForm] = useState(false);
  const [error, setError] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [stageFilter, setStageFilter] = useState<OrderStatus | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const [driverQuery, setDriverQuery] = useState("");
  if (!user) return null;

  const today = bishkekDateString(new Date(crm.now));
  const summary = summarizeDate(crm.state.events, user.id, today, crm.now, user.scheduleStart);
  const status = currentStatus(crm.state.events, user.id, new Date(crm.now));
  const open = openShift(crm.state.events, user.id);
  const stale = Boolean(open && bishkekDateString(new Date(open.events[0].at)) < today);
  const duration = open ? workedMs(open.events, crm.now) : summary.workedMs;
  const visible = crm.state.orders.filter((order) => canSeeOrder(order, user.id, false));
  const todayOrders = visible.filter((order) => bishkekDateString(new Date(order.createdAt)) === today);
  const doneToday = todayOrders.filter((order) => order.status === "done");
  const openOrders = visible.filter((order) => OPEN.includes(order.status));
  const intake = visible.filter((order) => INTAKE.includes(order.status));
  const trips = visible.filter((order) => TRIP.includes(order.status));
  const attention = ordersNeedingAttention(visible, crm.now);
  const appeals = crm.state.conversations.filter((conversation) => conversation.assigneeId === user.id || conversation.status === "new");
  const unreadAppeals = appeals.filter((conversation) => conversation.unread > 0 || conversation.status === "new");
  const drivers = [...crm.state.drivers].sort((a, b) => fullName(a).localeCompare(fullName(b), "ru"));
  const duties = drivers.map((driver) => ({ driver, duty: driverDuty(crm.state.orders, driver) }));
  const free = duties.filter((item) => item.duty === "available");
  const onLine = duties.filter((item) => item.duty !== "offline");
  const demoOnly = drivers.length > 0 && drivers.every((driver) => driver.note.includes("Демо"));
  const mine = crm.actor?.id === user.id && !crm.readOnly;
  const canStart = mine && (status === "idle" || status === "finished") && canPunch(status, "arrived");
  const canAway = mine && status === "working" && canPunch(status, "away");
  const canReturn = mine && status === "away" && canPunch(status, "arrived");
  const canFinish = mine && (status === "working" || status === "away") && canPunch(status, "finished");
  const canCall = telephony.status.connected && telephony.status.browserAnswer;
  const callHint = telephony.status.connected
    ? telephony.status.answerHint
    : "Телефония не подключена. Звонок из CRM не выполняется.";
  const funnel = FUNNEL.filter((item): item is Exclude<OrderStatus, "done" | "cancelled"> => item !== "done" && item !== "cancelled").map((stage) => ({
    stage,
    count: visible.filter((order) => order.status === stage).length,
  }));
  const hourPoints = HOURS.map((hour) => todayOrders.filter((order) => bishkekHour(order.createdAt) === hour).length);
  const doneShare = todayOrders.length ? Math.round((doneToday.length / todayOrders.length) * 100) : 0;
  const needle = query.trim().toLowerCase();
  const attentionIds = new Set(attention.map((item) => item.id));
  const rows = visible.filter((order) => {
    if (tab === "new" && !INTAKE.includes(order.status)) return false;
    if (tab === "attention" && !attentionIds.has(order.id)) return false;
    if (tab === "trips" && !TRIP.includes(order.status)) return false;
    if (tab === "all" && !OPEN.includes(order.status)) return false;
    if (stageFilter && order.status !== stageFilter) return false;
    const customer = crm.state.customers.find((item) => item.id === order.customerId);
    if (needle && !`${order.number} ${customer?.name ?? ""} ${customer?.phone ?? ""} ${order.pickup} ${order.dropoff}`.toLowerCase().includes(needle)) return false;
    return true;
  }).sort((a, b) => newestFirst ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt));
  const driverNeedle = driverQuery.trim().toLowerCase();
  const driverRows = duties.filter((item) => !driverNeedle || `${fullName(item.driver)} ${item.driver.phone}`.toLowerCase().includes(driverNeedle));

  function press(type: "arrived" | "away" | "finished") {
    setError("");
    const result = crm.punch(type);
    if (!result.ok && result.code === "confirm-finish") {
      setConfirmFinish(true);
      return;
    }
    if (!result.ok) setError(result.error);
  }

  function apply(result: { ok: true } | { ok: false; error: string }) {
    setError(result.ok ? "" : result.error);
  }

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">Рабочее место диспетчера</h2>
          <p className="mt-0.5 text-sm text-[#667085]">Приём заказов, назначение водителя и контроль поездки</p>
        </div>
        <span className={`flex h-10 items-center gap-2 rounded-[10px] border px-3 ${open && !stale ? "border-[#b7e0c7] bg-[#e7f6ee] text-[#1f7a45]" : "border-[#e6e8ec] bg-white text-[#52606d]"}`}>
          <span className={`h-2 w-2 rounded-full ${status === "working" ? "bg-[#1f7a45]" : status === "away" ? "bg-[#b45309]" : "bg-[#98a2b3]"}`} />
          <span>
            <span className="block text-xs font-semibold leading-tight">{stale ? "Закройте вчерашнюю смену" : open ? "Смена активна" : WORK_LABEL[status]}</span>
            <span className="block text-[11px] leading-tight opacity-80">{user.scheduleStart ? `начало ${user.scheduleStart}` : "график не задан"}</span>
          </span>
        </span>
        <span className="rounded-[10px] border border-[#e6e8ec] bg-white px-3 py-2 text-sm font-semibold tabular-nums">{open ? formatDuration(duration) : summary.workedMs ? formatDuration(summary.workedMs) : "0 ч 00 мин"}</span>
        <DeskButton enabled={canStart} onClick={() => press("arrived")}>Начать работу</DeskButton>
        <DeskButton enabled={canReturn} active={status === "working"} tone="green" onClick={() => press("arrived")}>На месте</DeskButton>
        <DeskButton enabled={canAway} active={status === "away"} tone="amber" onClick={() => press("away")}>Отошёл</DeskButton>
        <DeskButton enabled={canFinish} tone="red" onClick={() => press("finished")}>Завершить смену</DeskButton>
      </header>

      {stale && open ? <p className="text-sm text-[#b45309]">Смена не закрыта с {formatDate(open.events[0].at)}. Новую начать нельзя, пока эта не завершена.</p> : null}
      {crm.readOnly ? <p className="text-sm text-[#667085]">Просмотр. Отметки и изменения недоступны.</p> : null}
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setForm(true)} disabled={crm.readOnly}>Принять заказ</Button>
        <Link href="/drivers" className="inline-flex h-9 items-center rounded-lg border border-[#e6e8ec] bg-white px-3 text-sm hover:bg-[#f4f6f8]">Водители</Link>
        <Button variant="secondary" disabled title={callHint}>Позвонить клиенту</Button>
        {!canCall ? <p className="text-sm text-[#667085]">{callHint}</p> : null}
      </div>
      {telephony.status.connected || telephony.status.active.length > 0 ? <CallPanel /> : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Kpi tone="#2e6db4" label="Заказы сегодня" value={todayOrders.length} hint={todayOrders.length ? `${openOrders.length} открытых` : "сегодня заказов не было"} />
        <Kpi tone="#2e6db4" label="Звонки сегодня" value="0" hint="телефония не подключена" />
        <Kpi tone="#16a34a" label="Выполнено" value={doneToday.length} hint={todayOrders.length ? `${doneShare}% от заказов дня` : "нуль — выполненных нет"} />
        <Kpi tone="#2e6db4" label="Поездки" value={trips.length} hint="назначены и в пути" />
        <Kpi tone="#2e6db4" label="Водители на линии" value={onLine.length} hint={demoOnly ? `${free.length} свободны · демо-список` : `${free.length} свободны`} />
      </div>

      <section className="crm-panel px-3 py-3">
        <h3 className="text-sm font-semibold">Заказы по этапам</h3>
        <div className="mt-2 flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1">
            {funnel.map((item, index) => {
              const active = stageFilter === item.stage;
              return (
                <button
                  key={item.stage}
                  type="button"
                  title={`${ORDER_STATUS_LABEL[item.stage]}: ${item.count}`}
                  onClick={() => { setStageFilter(active ? null : item.stage); setTab("all"); }}
                  className={`relative -ml-2 h-[58px] min-w-0 flex-1 pr-2 pl-3.5 text-left first:ml-0 first:pl-3 ${active ? "ring-2 ring-[#1f2933]/20" : ""}`}
                  style={{
                    background: STAGE_COLOR[item.stage],
                    clipPath: index === 0
                      ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
                      : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                    zIndex: funnel.length - index,
                  }}
                >
                  <span className="block truncate text-[11px] font-semibold text-white">{shortStage(item.stage)}</span>
                  <span className="block text-lg font-bold leading-tight text-white tabular-nums">{item.count}</span>
                  <span className="block truncate text-[10px] text-white/80">{STAGE_HINT[item.stage]}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { setTab("attention"); setStageFilter(null); }}
            className="h-[58px] w-[110px] shrink-0 rounded-[10px] border border-[#f0d0d0] bg-[#fdecec] px-2.5 text-left"
          >
            <span className="block text-[11px] font-semibold text-[#c24141]">Проблемные</span>
            <span className="block text-lg font-bold leading-tight text-[#c24141] tabular-nums">{attention.length}</span>
            <span className="block truncate text-[10px] text-[#c24141]/80">требуют внимания</span>
          </button>
        </div>
      </section>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="crm-panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-[#e6e8ec] px-2 py-1.5">
            <TabButton active={tab === "all" && !stageFilter} onClick={() => { setTab("all"); setStageFilter(null); }} label="Все заказы" badge={String(openOrders.length)} />
            <TabButton active={tab === "new"} onClick={() => { setTab("new"); setStageFilter(null); }} label="Новые" badge={String(intake.length)} alert={intake.length > 0} />
            <TabButton active={tab === "attention"} onClick={() => { setTab("attention"); setStageFilter(null); }} label="Требуют внимания" badge={String(attention.length)} alert={attention.length > 0} />
            <TabButton active={tab === "trips"} onClick={() => { setTab("trips"); setStageFilter(null); }} label="Поездки" badge={String(trips.length)} />
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <input className={`${controlClass} h-8 w-[180px]`} placeholder="Имя, телефон, номер" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button type="button" className="h-8 rounded-lg border border-[#e6e8ec] bg-white px-2 text-xs text-[#52606d] hover:bg-[#f4f6f8]" onClick={() => setNewestFirst((value) => !value)}>
                {newestFirst ? "Сначала новые" : "Сначала старые"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#f7f8fa] text-xs text-[#667085]">
                <tr>
                  {["Клиент", "Телефон", "Этап", "Статус", "Водитель", "Время", "Следующее действие", ""].map((title) => (
                    <th key={title || "act"} className="px-3 py-2 font-medium">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-[#667085]">По этим условиям заказов нет</td></tr>
                ) : rows.map((order) => {
                  const customer = crm.state.customers.find((item) => item.id === order.customerId);
                  const driver = crm.state.drivers.find((item) => item.id === order.driverId);
                  const next = NEXT_STATUS[order.status];
                  const canAssign = order.status === "awaiting_driver" || order.status === "processing" || order.status === "assigned";
                  const progress = Math.max(1, OPEN.indexOf(order.status) + 1);
                  return (
                    <tr key={order.id} className="border-t border-[#e6e8ec] hover:bg-[#f8fafc]">
                      <td className="px-3 py-2">
                        <Link href={`/orders?order=${order.id}`} className="font-medium text-[#1d5fa7]">{customer?.name ?? "Клиент"}</Link>
                        <span className="mt-0.5 block text-xs text-[#98a2b3]">№{order.number} · {order.pickup} → {order.dropoff}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{customer?.phone ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className="block text-xs">{ORDER_STATUS_LABEL[order.status]}</span>
                        {OPEN.includes(order.status) ? (
                          <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-[#e6e8ec]">
                            <span className="block h-full rounded-full bg-[#2e6db4]" style={{ width: `${(progress / OPEN.length) * 100}%` }} />
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <StatusChip status={order.status} hold={order.hold} />
                      </td>
                      <td className="px-3 py-2">{driver ? fullName(driver) : "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className="block">{formatTime(order.createdAt)}</span>
                        <span className="block text-[#98a2b3]">{ageLabel(order.updatedAt || order.createdAt, crm.now)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {next ? (
                            <Button className="h-8" disabled={crm.readOnly} onClick={() => apply(crm.setOrderStatus(order.id, next))}>
                              {NEXT_STATUS_LABEL[next] ?? "Дальше"}
                            </Button>
                          ) : <span className="text-xs text-[#98a2b3]">{order.status === "done" ? "завершён" : order.status === "cancelled" ? "отменён" : "—"}</span>}
                          {canAssign && !crm.readOnly ? (
                            <select
                              className={`${controlClass} h-8 w-auto min-w-[140px]`}
                              defaultValue=""
                              aria-label={`Назначить водителя на заказ №${order.number}`}
                              onChange={(event) => {
                                const driverId = event.target.value;
                                if (driverId) apply(crm.assignOrderDriver(order.id, driverId));
                                event.target.value = "";
                              }}
                            >
                              <option value="">{free.length ? "Назначить" : "Нет свободных"}</option>
                              {free.map((item) => <option key={item.driver.id} value={item.driver.id}>{fullName(item.driver)}</option>)}
                            </select>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <IconButton label={callHint} disabled><PhoneIcon /></IconButton>
                          <Link href={`/orders?order=${order.id}`} className="grid h-8 w-8 place-items-center rounded-lg text-[#52606d] hover:bg-[#eef1f4]" aria-label="Открыть заказ">
                            <DotsIcon />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="crm-panel">
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-sm font-semibold">Сейчас сделать <span className="ml-1 rounded-full bg-[#c24141] px-1.5 text-[10px] font-semibold text-white">{attention.length}</span></h3>
            </div>
            {attention.length === 0 ? <p className="px-3 pb-3 text-sm text-[#667085]">Ничего не ждёт вашего действия</p> : attention.slice(0, 6).map((order) => {
              const customer = crm.state.customers.find((item) => item.id === order.customerId);
              const next = NEXT_STATUS[order.status];
              return (
                <Link key={order.id} href={`/orders?order=${order.id}`} className="flex items-start gap-2 border-t border-[#e6e8ec] px-3 py-2 text-sm hover:bg-[#f8fafc]">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${order.hold ? "bg-[#c24141]" : "bg-[#2e6db4]"}`} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">№{order.number} · {customer?.name ?? "Клиент"}</span>
                    <span className="block text-xs text-[#667085]">{next ? NEXT_STATUS_LABEL[next] : ORDER_STATUS_LABEL[order.status]} · {ageLabel(order.updatedAt || order.createdAt, crm.now)}</span>
                  </span>
                </Link>
              );
            })}
          </section>

          <section className="crm-panel">
            <div className="border-b border-[#e6e8ec] px-3 py-2">
              <h3 className="text-sm font-semibold">Водители</h3>
              <p className="text-xs text-[#667085]">{free.length} свободно · {duties.filter((item) => item.duty === "busy").length} с заказом{demoOnly ? " · демо" : ""}</p>
              <input className={`${controlClass} mt-2 h-8`} placeholder="Имя или телефон" value={driverQuery} onChange={(event) => setDriverQuery(event.target.value)} />
            </div>
            {driverRows.length === 0 ? <p className="px-3 py-3 text-sm text-[#667085]">Водителей нет</p> : driverRows.slice(0, 8).map((item) => (
              <div key={item.driver.id} className="flex items-center gap-2 border-t border-[#e6e8ec] px-3 py-2 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8f1fb] text-xs font-semibold text-[#1d5fa7]">{item.driver.firstName.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{fullName(item.driver)}</p>
                  <p className="truncate text-xs text-[#667085]">{item.driver.phone}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${dutyTone(item.duty)}`}>{DRIVER_DUTY_LABEL[item.duty]}</span>
                {item.duty === "busy" ? (
                  <Link href="/orders" className="text-xs text-[#1d5fa7]">Заказ</Link>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-[#1d5fa7] disabled:text-[#98a2b3]"
                    disabled={crm.readOnly}
                    onClick={() => apply(crm.setDriverAvailability(item.driver.id, item.driver.availability === "offline" ? "available" : "offline"))}
                  >
                    {item.driver.availability === "offline" ? "На линию" : "С линии"}
                  </button>
                )}
              </div>
            ))}
          </section>

          <section className="crm-panel">
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-sm font-semibold">Обращения</h3>
              <Link href="/chats" className="text-xs text-[#1d5fa7]">Все</Link>
            </div>
            {unreadAppeals.length === 0 ? <p className="px-3 pb-3 text-sm text-[#667085]">Новых обращений нет</p> : unreadAppeals.slice(0, 6).map((conversation) => {
              const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
              return (
                <Link key={conversation.id} href={`/chats?chat=${conversation.id}`} className="block border-t border-[#e6e8ec] px-3 py-2 text-sm hover:bg-[#f8fafc]">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{customer?.name ?? "Клиент"}</span>
                    <span className="text-xs text-[#98a2b3]">{formatTime(conversation.updatedAt)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-[#667085]">{conversation.status === "new" ? "Новое обращение" : `Непрочитано · ${conversation.unread}`}</span>
                </Link>
              );
            })}
          </section>
        </aside>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Моя эффективность</h3>
          <p className="text-xs text-[#667085]">Только ваши видимые заказы за сегодня. Нуль — записей не было.</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Donut percent={doneShare} />
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              <Eff value={todayOrders.length} label="Заказы дня" />
              <Eff value={intake.length} label="Новые" />
              <Eff value={doneToday.length} label="Выполнено" sub={todayOrders.length ? `${doneShare}%` : undefined} />
              <Eff value={onLine.length} label="На линии" />
            </div>
          </div>
        </section>
        <section className="crm-panel p-4">
          <h3 className="font-semibold">График работы</h3>
          <p className="text-xs text-[#667085]">Заказы, созданные сегодня. Пустые часы — нули, не оценка.</p>
          <BarChart points={hourPoints} />
        </section>
      </div>

      {form ? <OrderForm onClose={() => setForm(false)} /> : null}
      {confirmFinish ? (
        <Modal title="Завершить работу?" onClose={() => setConfirmFinish(false)}>
          <p className="text-sm text-[#52606d]">Статус сейчас «Отошёл». Время с момента отхода в рабочие часы не войдёт.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmFinish(false)}>Отмена</Button>
            <Button type="button" onClick={() => { const result = crm.punch("finished", true); if (!result.ok) setError(result.error); setConfirmFinish(false); }}>Завершить</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Kpi({ tone, label, value, hint }: { tone: string; label: string; value: number | string; hint: string }) {
  return (
    <article className="crm-panel flex gap-3 px-3 py-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: tone }}>
        <span className="h-2 w-2 rounded-full bg-white/90" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[#667085]">{label}</p>
        <p className="text-xl font-semibold tabular-nums leading-tight">{value}</p>
        <p className="truncate text-[11px] text-[#98a2b3]">{hint}</p>
      </div>
    </article>
  );
}

function TabButton({ active, onClick, label, badge, alert = false }: { active: boolean; onClick: () => void; label: string; badge: string; alert?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ${active ? "bg-[#e8f1fb] font-semibold text-[#1d5fa7]" : "text-[#52606d] hover:bg-[#f4f6f8]"}`}>
      {label}
      <span className={`rounded-full px-1.5 py-0.5 tabular-nums ${alert ? "bg-[#c24141] text-white" : "bg-[#eef1f4] text-[#52606d]"}`}>{badge}</span>
    </button>
  );
}

function StatusChip({ status, hold }: { status: OrderStatus; hold: Order["hold"] }) {
  const tone = status === "done" || status === "in_progress" || status === "en_route"
    ? "bg-[#e7f6ee] text-[#1f7a45]"
    : status === "cancelled" || hold
      ? "bg-[#fdecec] text-[#c24141]"
      : status === "new" || status === "processing"
        ? "bg-[#e8f1fb] text-[#1d5fa7]"
        : "bg-[#fff4e5] text-[#c05621]";
  return (
    <span className={`inline-flex max-w-[160px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{hold ? ORDER_HOLD_LABEL[hold] : ORDER_STATUS_LABEL[status]}</span>
    </span>
  );
}

function Donut({ percent }: { percent: number }) {
  const value = Math.min(100, Math.max(0, percent));
  const dash = `${value} ${100 - value}`;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e6e8ec" strokeWidth="3.5" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2e6db4" strokeWidth="3.5" strokeDasharray={dash} strokeDashoffset="0" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold">{value}%</span>
    </div>
  );
}

function Eff({ value, label, sub }: { value: number; label: string; sub?: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-[#667085]">{label}</p>
      {sub ? <p className="text-[11px] text-[#98a2b3]">{sub}</p> : null}
    </div>
  );
}

function BarChart({ points }: { points: number[] }) {
  const max = Math.max(1, ...points);
  return (
    <div className="mt-3 flex h-28 items-end gap-1">
      {points.map((value, index) => (
        <div key={HOURS[index]} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-20 w-full items-end rounded bg-[#f4f6f8]">
            <span className="w-full rounded-sm bg-[#2e6db4]" style={{ height: `${(value / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-[#98a2b3]">{HOURS[index]}</span>
        </div>
      ))}
    </div>
  );
}

function DeskButton({
  children,
  enabled,
  active = false,
  tone = "plain",
  onClick,
}: {
  children: string;
  enabled: boolean;
  active?: boolean;
  tone?: "plain" | "green" | "amber" | "red";
  onClick: () => void;
}) {
  const look = active
    ? tone === "amber"
      ? "border-[#b45309] bg-[#b45309] text-white"
      : "border-[#1f7a45] bg-[#1f7a45] text-white"
    : enabled
      ? tone === "red"
        ? "border-[#c24141] bg-[#c24141] text-white hover:bg-[#a33535]"
        : tone === "green"
          ? "border-[#1f7a45] bg-white text-[#1f7a45] hover:bg-[#e7f6ee]"
          : "border-[#d5dde5] bg-white text-[#1f2933] hover:bg-[#f5f8fb]"
      : "cursor-not-allowed border-[#e6e8ec] bg-[#f4f6f8] text-[#98a2b3]";
  return (
    <button type="button" disabled={!enabled} onClick={onClick} className={`h-9 rounded-lg border px-3 text-sm font-medium ${look}`}>
      {children}
    </button>
  );
}

function IconButton({ children, label, disabled }: { children: ReactNode; label: string; disabled?: boolean }) {
  return (
    <button type="button" title={label} disabled={disabled} className="grid h-8 w-8 place-items-center rounded-lg text-[#52606d] hover:bg-[#eef1f4] disabled:cursor-not-allowed disabled:text-[#c5cad3]">
      {children}
    </button>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 4h3l1.5 4-2 1.5a12 12 0 0 0 6 6L16.5 14l4 1.5V19a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

function shortStage(status: Exclude<OrderStatus, "done" | "cancelled">) {
  if (status === "new") return "Новый";
  if (status === "processing") return "Обработка";
  if (status === "awaiting_driver") return "Поиск";
  if (status === "assigned") return "Назначен";
  if (status === "en_route") return "Едет";
  return "Поездка";
}

function dutyTone(duty: "available" | "busy" | "offline") {
  if (duty === "available") return "bg-[#e7f6ee] text-[#1f7a45]";
  if (duty === "busy") return "bg-[#fff4e5] text-[#c05621]";
  return "bg-[#f4f6f8] text-[#667085]";
}

function ageLabel(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function bishkekHour(iso: string) {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bishkek", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return Number(hour);
}
