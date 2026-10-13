"use client";

import Link from "next/link";
import { DispatchDesk } from "@/components/dispatch-desk";
import { LoginForm } from "@/components/login-form";
import { ROLE_LABEL } from "@/lib/labels";
import { shiftSnapshot } from "@/lib/metrics";
import { useCrm } from "@/lib/store";
import { addDays, bishkekDateString } from "@/lib/time";

const HOURS = Array.from({ length: 13 }, (_, index) => index + 8);

export default function HomePage() {
  const crm = useCrm();
  if (!crm.ready) return <p className="text-[#667085]">Загрузка данных…</p>;
  if (!crm.user) return <LoginForm />;
  return crm.isAdmin ? <AdminHome /> : <DispatcherHome />;
}

function AdminHome() {
  const crm = useCrm();
  const today = bishkekDateString(new Date(crm.now));
  const yesterday = addDays(today, -1);
  const todayOrders = crm.state.orders.filter((order) => bishkekDateString(new Date(order.createdAt)) === today);
  const yesterdayCount = crm.state.orders.filter((order) => bishkekDateString(new Date(order.createdAt)) === yesterday).length;
  const done = todayOrders.filter((order) => order.status === "done").length;
  const cancelled = todayOrders.filter((order) => order.status === "cancelled").length;
  const active = todayOrders.filter((order) => order.status !== "done" && order.status !== "cancelled").length;
  const waitingDriver = crm.state.orders.filter((order) => order.status === "new" || order.status === "processing" || order.status === "awaiting_driver").length;
  const freshAppeals = crm.state.conversations.filter((conversation) => conversation.status === "new").length;
  const shifts = shiftSnapshot(crm.state, crm.now);
  const staff = crm.state.users.filter((user) => user.role === "dispatcher" && user.accountStatus === "active").length;
  const points = HOURS.map((hour) => todayOrders.filter((order) => bishkekHour(order.createdAt) === hour).length);
  const outsideHours = todayOrders.filter((order) => {
    const hour = bishkekHour(order.createdAt);
    return hour < HOURS[0] || hour > HOURS[HOURS.length - 1];
  }).length;
  const delta = yesterdayCount === 0 ? null : Math.round(((todayOrders.length - yesterdayCount) / yesterdayCount) * 100);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Обзор таксопарка</h2>
          <p className="mt-1 text-sm text-[#667085]">{longDay(crm.now)} · Бишкек</p>
        </div>
        <span className="rounded-full bg-[#e8f1fb] px-3 py-1 text-sm text-[#1d5fa7]">{ROLE_LABEL.admin}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric tone="blue" label="Заказы сегодня" value={todayOrders.length} hint={delta == null ? "Вчера заказов не было" : `${delta > 0 ? "+" : ""}${delta}% к прошлому дню`} icon="orders" />
        <Metric tone="green" label="Выполнено" value={done} hint={share(done, todayOrders.length, "от всех заказов")} icon="check" />
        <Metric tone="amber" label="В работе" value={active} hint={active ? "Требуют контроля" : "Сейчас нет"} icon="clock" />
        <Metric tone="rose" label="Отменено" value={cancelled} hint={share(cancelled, todayOrders.length, "от заказов")} icon="cross" />
      </div>

      <section className="crm-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Заказы по часам</h2>
          <span className="text-sm text-[#667085]">Сегодня</span>
        </div>
        <HourChart points={points} />
        <p className="mt-2 text-xs text-[#667085]">
          Только заказы, созданные сегодня, с 08:00 до 20:00.
          {outsideHours
            ? ` ${outsideHours} ${outsideHours === 1 ? "заказ создан" : "заказа создано"} вне 08:00–20:00, поэтому на линии их нет.`
            : " Нулевая линия означает, что в эти часы заказов не было."}
        </p>
      </section>

      <section className="crm-panel">
        <h2 className="border-b border-[#e6e8ec] px-4 py-3 font-semibold">Состояние диспетчерской</h2>
        <DeskRow label="Диспетчеры на смене" value={`${shifts.onShift} / ${staff}`} href="/time" />
        <DeskRow label="Ожидают назначения" value={String(waitingDriver)} href="/orders" />
        <DeskRow label="Необработанные обращения" value={String(freshAppeals)} href="/chats" />
      </section>
    </div>
  );
}

function share(part: number, total: number, tail: string) {
  if (!total) return "Заказов сегодня нет";
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
    blue: ["bg-[#e8f1fb]", "text-[#1d5fa7]"],
    green: ["bg-[#e7f6ee]", "text-[#1f7a45]"],
    amber: ["bg-[#fff4e5]", "text-[#c05621]"],
    rose: ["bg-[#fdecec]", "text-[#c24141]"],
  }[tone];
  return (
    <article className={`flex items-start justify-between rounded-2xl px-4 py-4 ${palette[0]}`}>
      <div>
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

function HourChart({ points }: { points: number[] }) {
  const width = 640;
  const height = 220;
  const left = 36;
  const right = 12;
  const top = 16;
  const bottom = 28;
  const max = Math.max(1, ...points);
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const coords = points.map((value, index) => {
    const x = left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = top + innerH - (value / max) * innerH;
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const ticks = max <= 1 ? [0, 1] : [0, Math.round(max / 2), max];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-56 w-full" role="img" aria-label="Заказы по часам за сегодня">
      {ticks.map((tick) => {
        const y = top + innerH - (tick / max) * innerH;
        return (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y} y2={y} stroke="#e6e8ec" />
            <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#98a2b3">{tick}</text>
          </g>
        );
      })}
      <polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map(([x, y], index) => {
        const hour = HOURS[index];
        return (
          <g key={hour}>
            {points[index] > 0 ? <circle cx={x} cy={y} r="3.5" fill="#3b82f6" /> : null}
            {hour % 2 === 0 ? <text x={x} y={height - 8} textAnchor="middle" fontSize="11" fill="#98a2b3">{String(hour).padStart(2, "0")}:00</text> : null}
          </g>
        );
      })}
    </svg>
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

function DispatcherHome() {
  return <DispatchDesk />;
}
