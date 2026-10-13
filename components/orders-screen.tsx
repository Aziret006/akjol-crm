"use client";

import { useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { OrderBoard } from "@/components/order-board";
import { OrderForm } from "@/components/order-form";
import { Button, Empty, ErrorText, Field, OrderBadge, controlClass } from "@/components/ui";
import { allows } from "@/lib/access";
import { DRIVER_DUTY_LABEL, NEXT_STATUS_LABEL, ORDER_HOLD_LABEL, ORDER_SOURCE_LABEL, ORDER_STATUS_LABEL, PAYMENT_LABEL, fullName } from "@/lib/labels";
import { NEXT_STATUS, canAssignDriver, canSeeOrder, driverDuty } from "@/lib/orders";
import { useCrm } from "@/lib/store";
import type { OrderHold, OrderStatus } from "@/lib/types";
import { formatDateTime, isoFromDateTimeLocal, toDateTimeLocal } from "@/lib/time";

const VIEW_KEY = "akjol-orders-view";
const VIEW_EVENT = "akjol-orders-view";

function subscribeView(onChange: () => void) {
  window.addEventListener(VIEW_EVENT, onChange);
  return () => window.removeEventListener(VIEW_EVENT, onChange);
}

function readView() {
  return window.sessionStorage.getItem(VIEW_KEY) === "table" ? "table" : "board";
}

const FILTERS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "processing", label: "Обработка" },
  { id: "awaiting_driver", label: "Поиск водителя" },
  { id: "assigned", label: "Водитель назначен" },
  { id: "en_route", label: "Едет к клиенту" },
  { id: "in_progress", label: "В поездке" },
  { id: "done", label: "Завершены" },
  { id: "cancelled", label: "Отменены" },
];

export function OrdersScreen() {
  const crm = useCrm();
  const params = useSearchParams();
  const paramOrder = params.get("order");
  const [seenOrder, setSeenOrder] = useState(paramOrder);
  const [selectedId, setSelectedId] = useState<string | null>(paramOrder);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [callbacks, setCallbacks] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [form, setForm] = useState(params.get("new") === "1");
  const [error, setError] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const view = useSyncExternalStore(subscribeView, readView, () => "board" as const);
  if (seenOrder !== paramOrder) {
    setSeenOrder(paramOrder);
    setSelectedId(paramOrder);
  }
  if (!crm.user) return null;
  const user = crm.user;

  const needle = query.trim().toLowerCase();
  const rows = crm.state.orders
    .filter((order) => canSeeOrder(order, user.id, allows(user.role, "orders.view_all")))
    .filter((order) => (callbacks ? order.hold === "callback" : true))
    .filter((order) => (filter === "all" || view === "board" ? true : order.status === filter))
    .filter((order) => {
      if (!needle) return true;
      const customer = crm.state.customers.find((item) => item.id === order.customerId);
      return `${order.number} ${customer?.name ?? ""} ${customer?.phone ?? ""}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = crm.state.orders.find((order) => order.id === selectedId) ?? null;
  const load = crm.isAdmin
    ? crm.state.users
        .filter((user) => user.role === "dispatcher" && user.accountStatus === "active")
        .map((user) => ({
          user,
          open: crm.state.orders.filter((order) => order.dispatcherId === user.id && order.status !== "done" && order.status !== "cancelled").length,
        }))
    : [];

  function run(result: { ok: boolean; error?: string }) {
    setError(result.ok || !result.error ? "" : result.error);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setForm(true)} disabled={crm.readOnly}>+ Новый заказ</Button>
        <input className={`${controlClass} max-w-xs`} placeholder="Номер, клиент или телефон" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="ml-auto flex rounded-lg bg-white p-1">
          {(["board", "table"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`h-8 rounded-md px-3 text-sm ${view === item ? "bg-[#2e6db4] text-white" : "text-[#52606d]"}`}
              onClick={() => {
                window.sessionStorage.setItem(VIEW_KEY, item);
                window.dispatchEvent(new Event(VIEW_EVENT));
              }}
            >
              {item === "board" ? "Воронка" : "Таблица"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => setCallbacks((value) => !value)} className={`h-8 rounded-lg px-3 text-sm ${callbacks ? "bg-[#2e6db4] text-white" : "bg-white text-[#52606d] hover:bg-[#f4f6f8]"}`}>Повторные звонки</button>
        {view === "table" ? FILTERS.map((item) => (
          <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`h-8 rounded-lg px-3 text-sm ${filter === item.id ? "bg-[#2e6db4] text-white" : "bg-white text-[#52606d] hover:bg-[#f4f6f8]"}`}>
            {item.label}
          </button>
        )) : null}
      </div>
      {crm.isAdmin ? (
        <div className="crm-panel flex flex-wrap gap-4 px-3 py-2 text-sm">
          {load.map((item) => <span key={item.user.id}>{fullName(item.user)}: {item.open} откр.</span>)}
          <span className="text-[#667085]">Доступны: {crm.state.drivers.filter((driver) => driverDuty(crm.state.orders, driver) === "available").length}</span>
        </div>
      ) : null}
      <div className={`grid items-start gap-3 ${view === "table" ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        {view === "board" ? (
          <OrderBoard
            orders={rows}
            customers={crm.state.customers}
            drivers={crm.state.drivers}
            users={crm.state.users}
            now={crm.now}
            selectedId={selectedId}
            draggingId={draggingId}
            readOnly={crm.readOnly}
            onSelect={(orderId) => { setSelectedId(orderId); setError(""); setCancelReason(""); }}
            onDrag={setDraggingId}
            onMove={(orderId, status) => run(crm.setOrderStatus(orderId, status))}
          />
        ) : rows.length === 0 ? <Empty title="Заказов нет" text="Создайте заказ по телефону или из обращения. Диспетчер видит свои заказы и общую очередь без водителя." /> : (
          <div className="overflow-x-auto crm-panel">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-[#f7f8fa] text-[#52606d]">
                <tr>
                  {["Номер", "Поступил", "Клиент", "Подача", "Назначение", "Источник", "Статус", "Водитель", "Диспетчер"].map((title) => (
                    <th key={title} className="px-3 py-2 font-medium">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const customer = crm.state.customers.find((item) => item.id === order.customerId);
                  const driver = crm.state.drivers.find((item) => item.id === order.driverId);
                  const dispatcher = crm.state.users.find((item) => item.id === order.dispatcherId);
                  return (
                    <tr key={order.id} className={`border-t border-[#e6e8ec] ${selectedId === order.id ? "bg-[#f3f8fd]" : "hover:bg-[#f8fafc]"}`}>
                      <td className="px-3 py-2">
                        <button type="button" className="font-medium text-[#1d5fa7]" onClick={() => { setSelectedId(order.id); setError(""); setCancelReason(""); }}>№{order.number}</button>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                      <td className="px-3 py-2">{customer?.name}<span className="block text-xs text-[#667085]">{customer?.phone}</span></td>
                      <td className="px-3 py-2">{order.pickup}</td>
                      <td className="px-3 py-2">{order.dropoff || "—"}</td>
                      <td className="px-3 py-2">{ORDER_SOURCE_LABEL[order.source]}</td>
                      <td className="px-3 py-2"><OrderBadge status={order.status} /></td>
                      <td className="px-3 py-2">{driver ? fullName(driver) : "—"}</td>
                      <td className="px-3 py-2">{dispatcher ? fullName(dispatcher) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <OrderPanel
          orderId={selected?.id ?? null}
          error={error}
          cancelReason={cancelReason}
          onReason={setCancelReason}
          onRun={run}
        />
      </div>
      {form ? <OrderForm onClose={() => setForm(false)} onCreated={(orderId) => setSelectedId(orderId)} /> : null}
    </div>
  );
}

function OrderPanel({
  orderId,
  error,
  cancelReason,
  onReason,
  onRun,
}: {
  orderId: string | null;
  error: string;
  cancelReason: string;
  onReason: (value: string) => void;
  onRun: (result: { ok: boolean; error?: string }) => void;
}) {
  const crm = useCrm();
  const order = crm.state.orders.find((item) => item.id === orderId) ?? null;
  if (!order) return <aside className="crm-panel p-3 text-sm text-[#667085]">Выберите заказ, чтобы назначить водителя или сменить статус.</aside>;
  const customer = crm.state.customers.find((item) => item.id === order.customerId);
  const dispatcher = crm.state.users.find((item) => item.id === order.dispatcherId);
  const history = crm.state.orderEvents.filter((event) => event.orderId === order.id);
  const closed = order.status === "done" || order.status === "cancelled";

  return (
    <aside className="crm-panel space-y-3 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">№{order.number}</h2>
        <OrderBadge status={order.status} />
      </div>
      <p>{customer?.name}<span className="block text-[#667085]">{customer?.phone}</span></p>
      <p>Подача: {order.pickup}</p>
      <p>Назначение: {order.dropoff || "—"}</p>
      <p>Время: {order.pickupAt ? formatDateTime(order.pickupAt) : "Сейчас"}</p>
      <p>Источник: {ORDER_SOURCE_LABEL[order.source]}</p>
      <p>Принял: {dispatcher ? fullName(dispatcher) : "—"} · {formatDateTime(order.createdAt)}</p>
      {order.passengers ? <p>Пассажиры: {order.passengers}</p> : null}
      {order.payment ? <p>Оплата: {PAYMENT_LABEL[order.payment]}</p> : null}
      {order.price != null ? <p>Предварительно: {order.price} сом</p> : null}
      {order.vehicleNote ? <p>Авто: {order.vehicleNote}</p> : null}
      {order.comment ? <p>Комментарий: {order.comment}</p> : null}
      {order.hold ? <p>Метка: {ORDER_HOLD_LABEL[order.hold]}{order.callbackAt ? ` · ${formatDateTime(order.callbackAt)}` : ""}</p> : null}
      {order.cancelReason ? <p>Причина отмены: {order.cancelReason}</p> : null}
      {order.callId ? <p>Звонок: {order.callId}</p> : null}
      <Field label="Водитель">
        <select
          className={controlClass}
          value={order.driverId ?? ""}
          disabled={crm.readOnly || closed}
          onChange={(event) => onRun(crm.assignOrderDriver(order.id, event.target.value || null))}
        >
          <option value="">Не назначен</option>
          {crm.state.drivers.map((driver) => {
            const allowed = driver.id === order.driverId || canAssignDriver(crm.state.orders, driver, order.id);
            const duty = driverDuty(crm.state.orders, driver, order.id);
            return (
              <option key={driver.id} value={driver.id} disabled={!allowed}>
                {fullName(driver)} · {driver.id === order.driverId ? "этот заказ" : DRIVER_DUTY_LABEL[duty]}
              </option>
            );
          })}
        </select>
      </Field>
      {!closed && !crm.readOnly ? (
        <div className="flex flex-wrap gap-2">
          {NEXT_STATUS[order.status] ? <Button onClick={() => onRun(crm.setOrderStatus(order.id, NEXT_STATUS[order.status]!))}>{NEXT_STATUS_LABEL[NEXT_STATUS[order.status]!] ?? "Дальше"}</Button> : null}
          <Button variant="secondary" onClick={() => onRun(crm.setOrderAttention(order.id, order.hold, order.callbackAt, order.priority === "high" ? "normal" : "high"))}>{order.priority === "high" ? "Снять срочность" : "Срочный"}</Button>
        </div>
      ) : null}
      {!closed && !crm.readOnly ? (
        <form key={order.id} className="space-y-2" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const hold = String(data.get("hold") ?? "");
          const when = String(data.get("when") ?? "");
          onRun(crm.setOrderAttention(order.id, hold ? hold as OrderHold : null, hold === "callback" ? isoFromDateTimeLocal(when) : null, order.priority));
        }}>
          <Field label="Ситуация">
            <select name="hold" className={controlClass} defaultValue={order.hold ?? ""}>
              <option value="">Без метки</option>
              {(Object.keys(ORDER_HOLD_LABEL) as OrderHold[]).map((item) => <option key={item} value={item}>{ORDER_HOLD_LABEL[item]}</option>)}
            </select>
          </Field>
          <Field label="Повторный звонок, Бишкек">
            <input name="when" className={controlClass} type="datetime-local" defaultValue={order.callbackAt ? toDateTimeLocal(order.callbackAt) : ""} />
          </Field>
          <Button variant="secondary" type="submit">Сохранить метку</Button>
        </form>
      ) : null}
      {crm.isAdmin && !closed ? (
        <Field label="Диспетчер">
          <select className={controlClass} value={order.dispatcherId} disabled={crm.readOnly} onChange={(event) => onRun(crm.reassignOrderDispatcher(order.id, event.target.value))}>
            {crm.state.users.filter((user) => user.role === "dispatcher" && (user.accountStatus === "active" || user.id === order.dispatcherId)).map((user) => (
              <option key={user.id} value={user.id}>{fullName(user)}</option>
            ))}
          </select>
        </Field>
      ) : null}
      {closed && crm.isAdmin && !crm.readOnly ? (
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); onRun(crm.reopenOrder(order.id, cancelReason)); }}>
          <Field label="Открыть снова">
            <input className={controlClass} placeholder="Причина" value={cancelReason} onChange={(event) => onReason(event.target.value)} />
          </Field>
          <Button variant="secondary" type="submit">Открыть заказ</Button>
        </form>
      ) : null}
      {!closed && !crm.readOnly ? (
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); onRun(crm.setOrderStatus(order.id, "cancelled", cancelReason)); }}>
          <Field label="Отмена">
            <input className={controlClass} placeholder="Причина" value={cancelReason} onChange={(event) => onReason(event.target.value)} />
          </Field>
          <Button variant="danger" type="submit">Отменить заказ</Button>
        </form>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <div>
        <p className="font-medium">История</p>
        <ul className="mt-2 space-y-2">
          {history.map((event) => {
            const actor = crm.state.users.find((item) => item.id === event.actorId);
            return (
              <li key={event.id}>
                <span className="block">{event.detail}</span>
                <span className="text-xs text-[#667085]">{actor ? fullName(actor) : "Система"} · {formatDateTime(event.at)}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-[#667085]">Текущий статус: {ORDER_STATUS_LABEL[order.status]}</p>
    </aside>
  );
}
