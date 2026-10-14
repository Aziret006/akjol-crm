"use client";

import Link from "next/link";
import { useState } from "react";
import { DispatchDesk } from "@/components/dispatch-desk";
import { LoginForm } from "@/components/login-form";
import { OrderBadge } from "@/components/ui";
import { allows } from "@/lib/access";
import { ORDER_HOLD_LABEL, ORDER_STATUS_LABEL, ROLE_LABEL, WORK_LABEL, fullName } from "@/lib/labels";
import { currentStatus, openShift, summarizeDate, workedMs } from "@/lib/attendance";
import { FUNNEL, canSeeOrder, ordersNeedingAttention } from "@/lib/orders";
import { shiftSnapshot } from "@/lib/metrics";
import { useCrm } from "@/lib/store";
import { addDays, bishkekDateString, formatDuration, formatTime, inDateRange } from "@/lib/time";
import type { WorkStatus } from "@/lib/types";

const HOURS = Array.from({ length: 13 }, (_, index) => index + 8);

export default function HomePage() {
  const crm = useCrm();
  if (!crm.ready) return <p className="text-[#667085]">Загрузка данных…</p>;
  if (!crm.user) return <LoginForm />;
  return crm.isAdmin ? <AdminHome /> : <DispatchDesk />;
}

function AdminHome() {
  const crm = useCrm();
  const user = crm.user;
  const [range, setRange] = useState<"today" | "yesterday" | "7" | "30">("today");
  if (!user) return null;
  const today = bishkekDateString(new Date(crm.now));
  const yesterday = addDays(today, -1);
  const bounds = range === "today"
    ? { from: today, to: today, label: "Сегодня" }
    : range === "yesterday"
      ? { from: yesterday, to: yesterday, label: "Вчера" }
      : { from: addDays(today, range === "7" ? -6 : -29), to: today, label: range === "7" ? "7 дней" : "30 дней" };
  const periodOrders = crm.state.orders.filter((order) => inDateRange(order.createdAt, bounds.from, bounds.to));
  const todayOrders = periodOrders;
  const yesterdayCount = crm.state.orders.filter((order) => inDateRange(order.createdAt, addDays(bounds.from, -1), addDays(bounds.to, -1))).length;
  const done = todayOrders.filter((order) => order.status === "done").length;
  const cancelled = todayOrders.filter((order) => order.status === "cancelled").length;
  const active = todayOrders.filter((order) => order.status !== "done" && order.status !== "cancelled").length;
  const waitingDriver = crm.state.orders.filter((order) => order.status === "new" || order.status === "processing" || order.status === "awaiting_driver").length;
  const freshAppeals = crm.state.conversations.filter((conversation) => conversation.status === "new");
  const unreadChats = crm.state.conversations.filter((conversation) => conversation.unread > 0);
  const shifts = shiftSnapshot(crm.state, crm.now);
  const staff = crm.state.users.filter((item) => item.role === "dispatcher" && item.accountStatus === "active");
  const points = HOURS.map((hour) => todayOrders.filter((order) => bishkekHour(order.createdAt) === hour).length);
  const outsideHours = todayOrders.filter((order) => {
    const hour = bishkekHour(order.createdAt);
    return hour < HOURS[0] || hour > HOURS[HOURS.length - 1];
  }).length;
  const delta = yesterdayCount === 0 ? null : Math.round(((todayOrders.length - yesterdayCount) / yesterdayCount) * 100);
  const attention = ordersNeedingAttention(crm.state.orders, crm.now).filter((order) => canSeeOrder(order, user.id, allows(user.role, "orders.view_all")));
  const openFunnel = FUNNEL.filter((status) => status !== "done" && status !== "cancelled").map((status) => ({
    status,
    count: crm.state.orders.filter((order) => order.status === status).length,
  }));
  const closedToday = FUNNEL.filter((status) => status === "done" || status === "cancelled").map((status) => ({
    status,
    count: todayOrders.filter((order) => order.status === status).length,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Панель администратора</h2>
          <p className="mt-1 text-sm text-[#667085]">{longDay(crm.now)} · Бишкек</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-[#e6e8ec] bg-white p-1" aria-label="Период статистики">
            {([['today', 'Сегодня'], ['yesterday', 'Вчера'], ['7', '7 дней'], ['30', '30 дней']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setRange(value)} className={`rounded-md px-2.5 py-1.5 text-xs transition ${range === value ? "bg-[#e8f1fb] font-medium text-[#1d5fa7]" : "text-[#667085] hover:bg-[#f4f6f8]"}`}>{label}</button>
            ))}
          </div>
          <Link href="/orders" className="inline-flex h-9 items-center rounded-lg bg-[#2e6db4] px-3 text-sm font-medium text-white hover:bg-[#245a96]">К заказам</Link>
          <Link href="/time" className="inline-flex h-9 items-center rounded-lg border border-[#e6e8ec] bg-white px-3 text-sm hover:bg-[#f4f6f8]">Смены</Link>
          <span className="rounded-full bg-[#e8f1fb] px-3 py-1 text-sm text-[#1d5fa7]">{ROLE_LABEL.admin}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#667085]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#1f7a45]" /> Данные обновляются автоматически · {bounds.label}</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric tone="blue" label="Регистрации сегодня" value={todayOrders.length} hint={delta == null ? "Вчера регистраций не было" : `${delta > 0 ? "+" : ""}${delta}% к прошлому дню`} icon="orders" />
        <Metric tone="green" label="Выполнено" value={done} hint={share(done, todayOrders.length, "от всех заказов")} icon="check" />
        <Metric tone="amber" label="В работе" value={active} hint={active ? "Требуют контроля" : "Сейчас нет"} icon="clock" />
        <Metric tone="rose" label="Отменено" value={cancelled} hint={share(cancelled, todayOrders.length, "от заказов")} icon="cross" />
      </div>

      <section className="crm-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Воронка заказов</h2>
          <p className="text-sm text-[#667085]">Открытые заказы по этапам · закрытые — за выбранный период</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {[...openFunnel, ...closedToday].map((item) => (
            <Link key={item.status} href="/orders" className="rounded-lg border border-[#e6e8ec] bg-[#f8fafc] px-3 py-3 text-[#1f2933] hover:border-[#c5d4e8] hover:text-[#1f2933]">
              <p className="text-xs text-[#667085]">{ORDER_STATUS_LABEL[item.status]}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{item.count}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="crm-panel min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-[#e6e8ec] px-4 py-3">
            <div>
              <h2 className="font-semibold">Требуют внимания</h2>
              <p className="text-xs text-[#667085]">Новые, без водителя дольше 10 минут, пометки «нет ответа» и «нужен администратор»</p>
            </div>
            <span className="rounded-full bg-[#f4f6f8] px-2 py-0.5 text-xs tabular-nums">{attention.length}</span>
          </div>
          {attention.length === 0 ? <p className="px-4 py-6 text-sm text-[#667085]">Сейчас нет заказов, которые ждут вмешательства.</p> : attention.slice(0, 12).map((order) => {
            const customer = crm.state.customers.find((item) => item.id === order.customerId);
            const dispatcher = crm.state.users.find((item) => item.id === order.dispatcherId);
            return (
              <Link key={order.id} href={`/orders?order=${order.id}`} className="block border-t border-[#e6e8ec] px-4 py-3 hover:bg-[#f8fafc]">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">№{order.number} · {customer?.name ?? "Клиент"}</span>
                  <OrderBadge status={order.status} />
                </span>
                <span className="mt-1 block truncate text-sm text-[#52606d]">{order.pickup} → {order.dropoff}</span>
                <span className="mt-1 flex flex-wrap gap-2 text-xs text-[#667085]">
                  {order.hold ? <span className="text-[#c05621]">{ORDER_HOLD_LABEL[order.hold]}</span> : null}
                  <span>{dispatcher ? fullName(dispatcher) : "Без диспетчера"}</span>
                  <span>{formatTime(order.updatedAt || order.createdAt)}</span>
                </span>
              </Link>
            );
          })}
        </section>

        <div className="space-y-4">
          <section className="crm-panel min-w-0">
            <h2 className="border-b border-[#e6e8ec] px-4 py-3 font-semibold">Состояние диспетчерской</h2>
            <DeskRow label="Диспетчеры на смене" value={`${shifts.onShift} / ${staff.length}`} href="/time" />
            <DeskRow label="Ожидают назначения" value={String(waitingDriver)} href="/orders" />
            <DeskRow label="Необработанные обращения" value={String(freshAppeals.length)} href="/chats" />
            <DeskRow label="Непрочитанные чаты" value={String(unreadChats.length)} href="/chats" />
          </section>
          <section className="crm-panel">
            <h2 className="border-b border-[#e6e8ec] px-4 py-3 font-semibold">Смены сейчас</h2>
            {staff.length === 0 ? <p className="px-4 py-4 text-sm text-[#667085]">Активных диспетчеров нет</p> : staff.map((item) => {
              const work = currentStatus(crm.state.events, item.id, new Date(crm.now));
              const open = openShift(crm.state.events, item.id);
              const todaySummary = summarizeDate(crm.state.events, item.id, today, crm.now, item.scheduleStart);
              const duration = open ? workedMs(open.events, crm.now) : todaySummary.workedMs;
              const stale = Boolean(open && bishkekDateString(new Date(open.events[0].at)) < today);
              return (
                <div key={item.id} className="flex items-center justify-between gap-2 border-t border-[#e6e8ec] px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{fullName(item)}</span>
                    <span className="block text-xs text-[#667085]">{stale ? "Смена не закрыта" : duration ? formatDuration(duration) : "Сегодня не отмечался"}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${shiftTone(work, stale)}`}>{stale ? "Не закрыта" : WORK_LABEL[work]}</span>
                </div>
              );
            })}
            {shifts.stale.length > 0 ? (
              <p className="border-t border-[#e6e8ec] px-4 py-2 text-xs text-[#b45309]">
                {shifts.stale.length} {shifts.stale.length === 1 ? "смена" : "смены"} со вчера не закрыты.
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="crm-panel min-w-0 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Регистрации по часам</h2>
            <span className="text-sm text-[#667085]">{bounds.label} · 08:00–20:00</span>
          </div>
          <HourChart points={points} periodLabel={bounds.label} />
          <p className="mt-2 text-xs text-[#667085]">
            Показываются регистрации за выбранный период.
            {outsideHours
              ? ` ${outsideHours} ${outsideHours === 1 ? "регистрация создана" : "регистрации созданы"} вне 08:00–20:00, поэтому на линии их нет.`
              : " Нулевая линия означает, что в эти часы регистраций не было."}
          </p>
        </section>
        <section className="crm-panel">
          <div className="flex items-center justify-between border-b border-[#e6e8ec] px-4 py-3">
            <h2 className="font-semibold">Новые обращения</h2>
            <Link href="/chats" className="text-xs text-[#1d5fa7]">Все</Link>
          </div>
          {freshAppeals.length === 0 ? <p className="px-4 py-4 text-sm text-[#667085]">Необработанных обращений нет</p> : freshAppeals.slice(0, 8).map((conversation) => {
            const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
            return (
              <Link key={conversation.id} href={`/chats?chat=${conversation.id}`} className="flex items-center justify-between gap-2 border-t border-[#e6e8ec] px-4 py-2.5 text-sm hover:bg-[#f8fafc]">
                <span className="truncate">{customer?.name ?? "Клиент"}</span>
                <span className="text-xs text-[#98a2b3]">{formatTime(conversation.updatedAt)}</span>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function share(part: number, total: number, tail: string) {
  if (!total) return "Нет данных за период";
  const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format((part / total) * 100);
  return `${percent}% ${tail}`;
}

function longDay(now: number) {
  const text = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Bishkek",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(now));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function bishkekHour(iso: string) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bishkek",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return Number(hour);
}

function Metric({
  tone,
  label,
  value,
  hint,
  icon,
}: {
  tone: "blue" | "green" | "amber" | "rose";
  label: string;
  value: number;
  hint: string;
  icon: "orders" | "check" | "clock" | "cross";
}) {
  const palette = {
    blue: ["bg-[#0d3556]", "text-[#5db9ff]"],
    green: ["bg-[#0b493f]", "text-[#35d6a0]"],
    amber: ["bg-[#4a361b]", "text-[#ffc84d]"],
    rose: ["bg-[#4a2630]", "text-[#ff7180]"],
  }[tone];
  return (
    <article className={`flex min-w-0 items-start justify-between rounded-[10px] px-4 py-4 ${palette[0]}`}>
      <div className="min-w-0">
        <p className="text-sm text-[#52606d]">{label}</p>
        <p className={`mt-2 text-4xl font-semibold leading-none ${palette[1]}`}>{value}</p>
        <p className="mt-2 text-sm text-[#667085]">{hint}</p>
      </div>
      <span className={`grid h-9 w-9 place-items-center rounded-full bg-white/80 ${palette[1]}`}>
        <MetricIcon name={icon} />
      </span>
    </article>
  );
}

function MetricIcon({ name }: { name: "orders" | "check" | "clock" | "cross" }) {
  const path = {
    orders: "M5 6h14v12H5V6Zm3 3h8M8 12h5",
    check: "M6 12.5 10 16l8-8",
    clock: "M12 7v5l3 2M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
    cross: "M8 8l8 8M16 8l-8 8",
  }[name];
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HourChart({ points, periodLabel }: { points: number[]; periodLabel: string }) {
  const max = Math.max(1, ...points);
  const ticks = max <= 1 ? [0, 1] : [0, Math.round(max / 2), max];
  const coords = points.map((value, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 100 - (value / max) * 100;
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const labels = HOURS.filter((hour) => hour % 2 === 0);

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <div className="relative h-40 w-8 shrink-0 text-[11px] text-[#98a2b3]">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (tick / max) * 100}%` }}>{tick}</span>
          ))}
        </div>
        <div className="relative h-40 min-w-0 flex-1">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={`Регистрации по часам за ${periodLabel.toLowerCase()}`}>
            {ticks.map((tick) => {
              const y = 100 - (tick / max) * 100;
              return <line key={tick} x1="0" x2="100" y1={y} y2={y} stroke="#e6e8ec" vectorEffect="non-scaling-stroke" />;
            })}
            <polyline points={line} fill="none" stroke="#2e6db4" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {coords.map(([x, y], index) => points[index] > 0 ? (
            <span key={HOURS[index]} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2e6db4]" style={{ left: `${x}%`, top: `${y}%` }} />
          ) : null)}
        </div>
      </div>
      <div className="mt-2 ml-10 flex justify-between text-[11px] text-[#98a2b3]">
        {labels.map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}
      </div>
    </div>
  );
}

function DeskRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between border-b border-[#e6e8ec] px-4 py-3 text-sm last:border-b-0 hover:bg-[#f8fafc]">
      <span>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </Link>
  );
}

function shiftTone(status: WorkStatus, stale: boolean) {
  if (stale) return "bg-[#fff4e5] text-[#b45309]";
  if (status === "working") return "bg-[#e7f6ee] text-[#1f7a45]";
  if (status === "away") return "bg-[#fff4e5] text-[#b45309]";
  if (status === "finished") return "bg-[#eef1f4] text-[#52606d]";
  return "bg-[#f4f6f8] text-[#667085]";
}
