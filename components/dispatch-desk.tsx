"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AttendanceControls } from "@/components/attendance-controls";
import { CallPanel } from "@/components/call-panel";
import { OrderForm } from "@/components/order-form";
import { Button, DutyBadge, OrderBadge } from "@/components/ui";
import { currentStatus, openShift, summarizeDate, workedMs } from "@/lib/attendance";
import { fullName } from "@/lib/labels";
import { canSeeOrder, driverDuty, ordersNeedingAttention } from "@/lib/orders";
import { useCrm } from "@/lib/store";
import { bishkekDateString, formatDateTime, formatDuration } from "@/lib/time";

export function DispatchDesk() {
  const crm = useCrm();
  const user = crm.user;
  const [form, setForm] = useState(false);
  const [error, setError] = useState("");
  if (!user) return null;

  const today = bishkekDateString(new Date(crm.now));
  const summary = summarizeDate(crm.state.events, user.id, today, crm.now, user.scheduleStart);
  const status = currentStatus(crm.state.events, user.id, new Date(crm.now));
  const open = openShift(crm.state.events, user.id);
  const stale = Boolean(open && bishkekDateString(new Date(open.events[0].at)) < today);
  const duration = open ? workedMs(open.events, crm.now) : summary.workedMs;
  const visible = crm.state.orders.filter((order) => canSeeOrder(order, user.id, false));
  const fresh = visible.filter((order) => order.status === "new" || order.status === "processing" || order.status === "awaiting_driver");
  const trips = visible.filter((order) => order.status === "assigned" || order.status === "en_route" || order.status === "in_progress");
  const appeals = crm.state.conversations.filter((conversation) => conversation.status === "new" || (conversation.assigneeId === user.id && conversation.status !== "done"));
  const attention = ordersNeedingAttention(visible, crm.now);
  const drivers = [...crm.state.drivers].sort((a, b) => driverDuty(crm.state.orders, a).localeCompare(driverDuty(crm.state.orders, b)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setForm(true)} disabled={crm.readOnly}>Принять заказ</Button>
        <Button variant="secondary" disabled title="Исходящий набор через браузер недоступен: телефония не подключена">Позвонить клиенту</Button>
        <Link href="/orders" className="crm-link text-sm">Вся очередь</Link>
      </div>
      <CallPanel />
      <div className="crm-panel flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
        <p>
          Смена: {summary.events.length === 0 && !open ? "нет отметки сегодня" : stale ? `не закрыта с ${formatDateTime(open!.events[0].at)}` : status === "working" ? "на работе" : status === "away" ? "отошёл" : status === "finished" ? "завершена" : "не начата"}
          {open || summary.events.length ? ` · ${formatDuration(duration)}` : ""}
        </p>
        {attention.length > 0 ? <p>{attention.length} заказ(ов) без водителя</p> : <p className="text-[#667085]">Заказов, требующих внимания, нет</p>}
      </div>
      <AttendanceControls userId={user.id} showLog={false} />
      <div className="grid gap-3 xl:grid-cols-3">
        <Queue title="Новые и без водителя" empty="Таких заказов нет">
          {fresh.map((order) => <OrderRow key={order.id} orderId={order.id} />)}
        </Queue>
        <Queue title="Назначены и в пути" empty="Активных поездок нет">
          {trips.map((order) => <OrderRow key={order.id} orderId={order.id} />)}
        </Queue>
        <section className="crm-panel">
          <h2 className="border-b border-[#e6e8ec] px-3 py-2 text-sm font-semibold">Водители</h2>
          {drivers.length === 0 ? <p className="px-3 py-3 text-sm text-[#667085]">Водителей нет</p> : drivers.map((driver) => {
            const duty = driverDuty(crm.state.orders, driver);
            const current = crm.state.orders.find((order) => order.driverId === driver.id && (order.status === "assigned" || order.status === "en_route" || order.status === "in_progress"));
            return (
              <div key={driver.id} className="flex items-center justify-between gap-2 border-t border-[#e6e8ec] px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{fullName(driver)}</span>
                  <span className="block truncate text-xs text-[#667085]">{driver.vehicle ?? "Автомобиль не закреплён"}{driver.note.includes("Демо") ? " · демо" : ""}{current ? ` · №${current.number}` : ""}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <DutyBadge duty={duty} />
                  {duty !== "busy" ? (
                    <button
                      className="text-xs text-[#2e6db4] disabled:text-[#98a2b3]"
                      type="button"
                      disabled={crm.readOnly}
                      onClick={() => {
                        const result = crm.setDriverAvailability(driver.id, driver.availability === "offline" ? "available" : "offline");
                        setError(result.ok ? "" : result.error);
                      }}
                    >
                      {driver.availability === "offline" ? "На линию" : "С линии"}
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
          {error ? <p className="px-3 py-2 text-sm text-[#b42318]">{error}</p> : null}
        </section>
      </div>
      <section className="crm-panel">
        <div className="flex items-center justify-between border-b border-[#e6e8ec] px-3 py-2">
          <h2 className="text-sm font-semibold">Необработанные обращения</h2>
          <Link href="/chats" className="crm-link text-sm">Чаты</Link>
        </div>
        {appeals.length === 0 ? <p className="px-3 py-3 text-sm text-[#667085]">Открытых обращений нет</p> : appeals.slice(0, 6).map((conversation) => {
          const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
          return (
            <Link key={conversation.id} href={`/chats?chat=${conversation.id}`} className="flex items-center justify-between gap-3 border-t border-[#e6e8ec] px-3 py-2 text-sm hover:bg-[#f8fafc]">
              <span className="truncate">{customer?.name}</span>
              <span className="shrink-0 text-xs text-[#667085]">{customer?.phone}</span>
            </Link>
          );
        })}
      </section>
      {form ? <OrderForm onClose={() => setForm(false)} /> : null}
    </div>
  );
}

function Queue({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <section className="crm-panel">
      <h2 className="border-b border-[#e6e8ec] px-3 py-2 text-sm font-semibold">{title}</h2>
      {items.length === 0 ? <p className="px-3 py-3 text-sm text-[#667085]">{empty}</p> : items}
    </section>
  );
}

function OrderRow({ orderId }: { orderId: string }) {
  const crm = useCrm();
  const order = crm.state.orders.find((item) => item.id === orderId);
  if (!order) return null;
  const customer = crm.state.customers.find((item) => item.id === order.customerId);
  const driver = crm.state.drivers.find((item) => item.id === order.driverId);
  return (
    <Link href={`/orders?order=${order.id}`} className="block border-t border-[#e6e8ec] px-3 py-2 text-sm hover:bg-[#f8fafc]">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium">№{order.number}</span>
        <OrderBadge status={order.status} />
      </span>
      <span className="mt-1 block truncate">{customer?.name} · {customer?.phone}</span>
      <span className="block truncate text-[#667085]">{order.pickup}{driver ? ` · ${fullName(driver)}` : ""}</span>
    </Link>
  );
}
