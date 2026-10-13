"use client";

import { OrderBadge } from "@/components/ui";
import { ORDER_HOLD_LABEL, ORDER_SOURCE_LABEL, fullName } from "@/lib/labels";
import { canDropStatus, FUNNEL } from "@/lib/orders";
import type { Customer, Driver, Order, OrderStatus, User } from "@/lib/types";

export function OrderBoard({
  orders,
  customers,
  drivers,
  users,
  now,
  selectedId,
  draggingId,
  readOnly,
  onSelect,
  onDrag,
  onMove,
}: {
  orders: Order[];
  customers: Customer[];
  drivers: Driver[];
  users: User[];
  now: number;
  selectedId: string | null;
  draggingId: string | null;
  readOnly: boolean;
  onSelect: (orderId: string) => void;
  onDrag: (orderId: string | null) => void;
  onMove: (orderId: string, status: OrderStatus) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {FUNNEL.map((status) => {
        const cards = orders.filter((order) => order.status === status);
        return (
          <section
            key={status}
            className="w-64 shrink-0"
            onDragOver={(event) => {
              const dragging = orders.find((order) => order.id === draggingId);
              if (dragging && canDropStatus(dragging.status, status)) event.preventDefault();
            }}
            onDrop={(event) => {
              const orderId = event.dataTransfer.getData("text/plain");
              const order = orders.find((item) => item.id === orderId);
              if (!order || !canDropStatus(order.status, status)) return;
              event.preventDefault();
              onMove(orderId, status);
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <h2 className="text-sm font-semibold">{statusTitle(status)}</h2>
              <span className="text-xs text-[#667085]">{cards.length}</span>
            </div>
            <div className="min-h-28 space-y-2 rounded-xl bg-[#f3f5f8] p-2">
              {cards.length === 0 ? <p className="px-1 py-4 text-center text-xs text-[#98a2b3]">Пусто</p> : null}
              {cards.map((order) => {
                const customer = customers.find((item) => item.id === order.customerId);
                const driver = drivers.find((item) => item.id === order.driverId);
                const dispatcher = users.find((item) => item.id === order.dispatcherId);
                const stale = now > 0 && now - new Date(order.updatedAt).getTime() > 10 * 60 * 1000 && order.status !== "done" && order.status !== "cancelled";
                return (
                  <article
                    key={order.id}
                    draggable={!readOnly && order.status !== "done" && order.status !== "cancelled"}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", order.id);
                      event.dataTransfer.effectAllowed = "move";
                      onDrag(order.id);
                    }}
                    onDragEnd={() => onDrag(null)}
                    className={`cursor-pointer rounded-lg border bg-white p-2 text-sm ${selectedId === order.id ? "border-[#2e6db4]" : "border-[#e6e8ec]"}`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => onSelect(order.id)}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">№{order.number}</span>
                        {order.priority === "high" ? <span className="text-xs text-[#b42318]">Срочный</span> : null}
                      </span>
                      <span className="mt-1 block">{customer?.name ?? "Клиент"}</span>
                      <span className="block text-xs text-[#667085]">{customer?.phone}</span>
                      <span className="mt-1 block truncate">{order.pickup}</span>
                      {order.dropoff ? <span className="block truncate text-[#52606d]">→ {order.dropoff}</span> : null}
                      <span className="mt-2 flex flex-wrap items-center gap-1">
                        <OrderBadge status={order.status} />
                        {order.hold ? <span className="rounded bg-[#fff4d6] px-1.5 py-0.5 text-xs text-[#8a5a00]">{ORDER_HOLD_LABEL[order.hold]}</span> : null}
                        {stale ? <span className="rounded bg-[#fdecec] px-1.5 py-0.5 text-xs text-[#b42318]">Без движения</span> : null}
                      </span>
                      <span className="mt-2 block text-xs text-[#667085]">{ORDER_SOURCE_LABEL[order.source]} · {driver ? fullName(driver) : "водитель не назначен"}</span>
                      <span className="block text-xs text-[#667085]">{dispatcher ? fullName(dispatcher) : "без диспетчера"} · {age(order.updatedAt, now)}</span>
                      {order.price != null ? <span className="block text-xs text-[#667085]">{order.price} сом</span> : null}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function statusTitle(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    new: "Новый",
    processing: "Обработка",
    awaiting_driver: "Поиск водителя",
    assigned: "Назначен",
    en_route: "Едет",
    in_progress: "В поездке",
    done: "Завершён",
    cancelled: "Отменён",
  };
  return labels[status];
}

function age(iso: string, now: number) {
  if (!now) return "";
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${String(minutes % 60).padStart(2, "0")} мин`;
}
