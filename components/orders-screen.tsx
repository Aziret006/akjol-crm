"use client";

import { useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { OrderBoard } from "@/components/order-board";
import { OrderForm } from "@/components/order-form";
import { Button, Empty, ErrorText, Field, Modal, OrderBadge, controlClass } from "@/components/ui";
import { allows } from "@/lib/access";
import { ORDER_SOURCE_LABEL, ORDER_SOURCE_OPTIONS, fullName } from "@/lib/labels";
import { FUNNEL, canSeeOrder } from "@/lib/orders";
import { useCrm } from "@/lib/store";
import type { OrderSource, OrderStatus } from "@/lib/types";
import { formatDateTime, inDateRange, periodBounds } from "@/lib/time";

const VIEW_KEY = "akjol-orders-view";
const VIEW_EVENT = "akjol-orders-view";

function subscribeView(onChange: () => void) {
  window.addEventListener(VIEW_EVENT, onChange);
  return () => window.removeEventListener(VIEW_EVENT, onChange);
}

function readView() {
  return window.sessionStorage.getItem(VIEW_KEY) === "table" ? "table" : "board";
}

const DOT: Record<OrderStatus, string> = {
  new: "#3b82f6",
  processing: "#22c55e",
  awaiting_driver: "#ef4444",
  assigned: "#8b5cf6",
  en_route: "#0ea5e9",
  in_progress: "#eab308",
  done: "#16a34a",
  cancelled: "#f97316",
};

const STAGE_SHORT: Record<OrderStatus, string> = {
  new: "Новый",
  processing: "Обработка",
  awaiting_driver: "Поиск",
  assigned: "Назначен",
  en_route: "Едет",
  in_progress: "Поездка",
  done: "Завершён",
  cancelled: "Отменён",
};

const EMPTY_CLIENT = { id: "", name: "", phone: "", city: "Бишкек", address: "", note: "" };

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
  const [source, setSource] = useState<OrderSource | "all">("all");
  const [owner, setOwner] = useState("all");
  const [kind, setKind] = useState<"all" | "open" | "done" | "cancelled" | "callback">("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [form, setForm] = useState(params.get("new") === "1");
  const [orderPreset, setOrderPreset] = useState<{ phone?: string; name?: string } | undefined>(undefined);
  const [client, setClient] = useState<typeof EMPTY_CLIENT | null>(null);
  const [clientError, setClientError] = useState("");
  const [error, setError] = useState("");
  const view = useSyncExternalStore(subscribeView, readView, () => "board" as const);
  if (seenOrder !== paramOrder) {
    setSeenOrder(paramOrder);
    setSelectedId(paramOrder);
  }
  if (!crm.user) return null;
  const user = crm.user;

  const needle = query.trim().toLowerCase();
  const visible = crm.state.orders.filter((order) => canSeeOrder(order, user.id, allows(user.role, "orders.view_all")));
  const month = crm.now ? periodBounds("month", new Date(crm.now)) : null;
  const inMonth = (iso: string) => (month ? inDateRange(iso, month.from, month.to) : false);
  const working = visible.filter((order) => order.status !== "done" && order.status !== "cancelled");
  const workingSum = working.reduce((sum, order) => sum + (order.price ?? 0), 0);
  const doneCount = visible.filter((order) => order.status === "done").length;
  const cancelledCount = visible.filter((order) => order.status === "cancelled").length;
  const monthCount = visible.filter((order) => inMonth(order.createdAt)).length;
  const funnel = FUNNEL.map((status) => {
    const items = visible.filter((order) => order.status === status);
    return { status, count: items.length, month: items.filter((order) => inMonth(order.createdAt)).length };
  });
  const stuck = funnel.filter((item) => item.status !== "done" && item.status !== "cancelled").reduce<(typeof funnel)[number] | null>((best, item) => (!best || item.count > best.count ? item : best), null);
  const rows = visible
    .filter((order) => (filter === "all" ? true : order.status === filter))
    .filter((order) => (source === "all" ? true : order.source === source))
    .filter((order) => (owner === "all" ? true : order.dispatcherId === owner))
    .filter((order) => {
      if (kind === "open") return order.status !== "done" && order.status !== "cancelled";
      if (kind === "done") return order.status === "done";
      if (kind === "cancelled") return order.status === "cancelled";
      if (kind === "callback") return order.hold === "callback";
      return true;
    })
    .filter((order) => {
      if (!needle) return true;
      const customer = crm.state.customers.find((item) => item.id === order.customerId);
      const driver = crm.state.drivers.find((item) => item.id === order.driverId);
      return `${order.number} ${customer?.name ?? ""} ${customer?.phone ?? ""} ${order.pickup} ${order.dropoff} ${driver ? fullName(driver) : ""}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const staff = crm.state.users.filter((item) => item.role === "dispatcher" && item.accountStatus === "active");

  function run(result: { ok: boolean; error?: string }) {
    setError(result.ok || !result.error ? "" : result.error);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="В работе" value={String(working.length)} extra={formatSom(workingSum)} />
        <Metric label="Успех" value={String(doneCount)} tone="text-[#1f7a45]" />
        <Metric label="Отказ" value={String(cancelledCount)} tone="text-[#c24141]" />
        <Metric label="Новых за месяц" value={String(monthCount)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {funnel.map((item) => {
          const active = filter === item.status;
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => {
                const next = active ? "all" : item.status;
                setFilter(next);
                if (next !== "all") document.getElementById(`order-col-${item.status}`)?.scrollIntoView({ inline: "start", block: "nearest" });
              }}
              className={`flex min-w-[168px] flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-left ${active ? "border-[#e6b325] bg-[#fffaf0]" : "border-[#e6e8ec]"}`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[item.status] }} />
              <span className="min-w-0">
                <span className="block truncate text-sm text-[#344054]">{STAGE_SHORT[item.status]}</span>
                <span className="block text-[11px] text-[#98a2b3]">{item.month} за месяц</span>
              </span>
              <span className="ml-auto text-lg font-semibold tabular-nums text-[#1f2933]">{item.count}</span>
            </button>
          );
        })}
      </div>

      {stuck && stuck.count > 0 ? (
        <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-[#f3e2c2] bg-[#fff8ee] px-3 py-2 text-left text-sm text-[#8a5a00]" onClick={() => { setFilter(stuck.status); document.getElementById(`order-col-${stuck.status}`)?.scrollIntoView({ inline: "start", block: "nearest" }); }}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#e6b325] text-[10px]">!</span>
          Чаще всего стоят на «{STAGE_SHORT[stuck.status]}» — {stuck.count} {orderWord(stuck.count)}.
          <span className="ml-1 underline">Разобрать</span>
        </button>
      ) : null}

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e6e8ec] bg-white px-3 py-2" onSubmit={(event) => { event.preventDefault(); setFilter(filter); }}>
        <input className="h-9 min-w-[180px] flex-1 bg-transparent text-sm outline-none" placeholder="Имя, телефон, адрес" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="h-9 bg-transparent text-sm text-[#344054]" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Этап">
          {FILTERS.map((item) => <option key={item.id} value={item.id}>{item.id === "all" ? "Этап — все" : item.label}</option>)}
        </select>
        <select className="h-9 bg-transparent text-sm text-[#344054]" value={source} onChange={(event) => setSource(event.target.value as typeof source)} aria-label="Источник">
          <option value="all">Источник — все</option>
          {ORDER_SOURCE_OPTIONS.map((item) => <option key={item} value={item}>{ORDER_SOURCE_LABEL[item]}</option>)}
        </select>
        <select className="h-9 bg-transparent text-sm text-[#344054]" value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Ответственный">
          <option value="all">Ответственный</option>
          {staff.map((item) => <option key={item.id} value={item.id}>{fullName(item)}</option>)}
        </select>
        <select className="h-9 bg-transparent text-sm text-[#344054]" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} aria-label="Статус">
          <option value="all">Статус — все</option>
          <option value="open">В работе</option>
          <option value="done">Успех</option>
          <option value="cancelled">Отказ</option>
          <option value="callback">Повторный звонок</option>
        </select>
        <button type="submit" className="h-9 rounded-lg bg-[#1f7a4c] px-4 text-sm font-medium text-white">Найти</button>
        <button type="button" className="h-9 rounded-lg border border-[#e6e8ec] px-3 text-sm text-[#52606d]" disabled={crm.readOnly} onClick={() => { setClient({ ...EMPTY_CLIENT }); setClientError(""); }}>Карточка</button>
        <button
          type="button"
          className="h-9 rounded-lg px-2 text-sm text-[#667085]"
          onClick={() => {
            const next = view === "board" ? "table" : "board";
            window.sessionStorage.setItem(VIEW_KEY, next);
            window.dispatchEvent(new Event(VIEW_EVENT));
          }}
        >
          {view === "board" ? "Таблица" : "Доска"}
        </button>
      </form>
      <ErrorText>{error}</ErrorText>
      <div>
        {view === "board" ? (
          <OrderBoard
            orders={rows}
            customers={crm.state.customers}
            drivers={crm.state.drivers}
            selectedId={selectedId}
            draggingId={draggingId}
            readOnly={crm.readOnly}
            activeStatus={filter === "all" ? null : filter}
            onSelect={(orderId) => { setSelectedId(orderId); setError(""); }}
            onDrag={setDraggingId}
            onMove={(orderId, status) => run(crm.setOrderStatus(orderId, status))}
            onAdd={(status, name) => {
              const result = crm.createOrder({
                phone: "",
                name,
                pickup: "",
                dropoff: "",
                pickupAt: null,
                comment: "",
                passengers: null,
                payment: null,
                price: null,
                source: "phone",
                driverId: null,
                vehicleNote: "",
                conversationId: null,
                callId: null,
                idempotencyKey: crypto.randomUUID(),
                confirmDuplicate: true,
                intake: true,
                draft: true,
                status,
              });
              run(result);
            }}
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
                        <span className="font-medium">№{order.number}</span>
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
      </div>
      {form ? <OrderForm preset={orderPreset} onClose={() => { setForm(false); setOrderPreset(undefined); }} /> : null}
      {client ? (
        <Modal title={client.id ? "Карточка клиента" : "Новый клиент"} onClose={() => setClient(null)}>
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            const result = crm.saveCustomer(client);
            if (!result.ok) { setClientError(result.error); return; }
            setClient(null);
          }}>
            <ErrorText>{clientError}</ErrorText>
            <Field label="Имя"><input className={controlClass} value={client.name} onChange={(event) => setClient({ ...client, name: event.target.value })} required /></Field>
            <Field label="Телефон"><input className={controlClass} value={client.phone} onChange={(event) => setClient({ ...client, phone: event.target.value })} required /></Field>
            <Field label="Город"><input className={controlClass} value={client.city} onChange={(event) => setClient({ ...client, city: event.target.value })} /></Field>
            <Field label="Адрес"><input className={controlClass} value={client.address} onChange={(event) => setClient({ ...client, address: event.target.value })} /></Field>
            <Field label="Заметка"><input className={controlClass} value={client.note} onChange={(event) => setClient({ ...client, note: event.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <Button type="submit">Сохранить</Button>
              <Button type="button" onClick={() => {
                const saved = crm.saveCustomer(client);
                if (!saved.ok) { setClientError(saved.error); return; }
                const result = crm.createOrder({
                  phone: client.phone,
                  name: client.name,
                  pickup: client.address.trim() || client.city.trim() || "Бишкек",
                  dropoff: "",
                  pickupAt: null,
                  comment: client.note,
                  passengers: null,
                  payment: null,
                  price: null,
                  source: "phone",
                  driverId: null,
                  vehicleNote: "",
                  conversationId: null,
                  callId: null,
                  idempotencyKey: crypto.randomUUID(),
                  confirmDuplicate: true,
                  intake: true,
                });
                if (!result.ok) { setClientError(result.error); return; }
                setClient(null);
                document.getElementById("order-col-new")?.scrollIntoView({ inline: "start", block: "nearest" });
              }}>На доску</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function formatSom(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} сом`;
}

function orderWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "заказ";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "заказа";
  return "заказов";
}

function Metric({ label, value, extra, tone = "text-[#1f2933]" }: { label: string; value: string; extra?: string; tone?: string }) {
  return (
    <article className="rounded-xl border border-[#e6e8ec] bg-white px-4 py-3">
      <p className="text-sm text-[#667085]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}{extra ? <span className="ml-2 text-sm font-medium text-[#98a2b3]">{extra}</span> : null}</p>
    </article>
  );
}

