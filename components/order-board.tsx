"use client";

import { ORDER_HOLD_LABEL, ORDER_SOURCE_LABEL, fullName } from "@/lib/labels";
import { canDropStatus, FUNNEL } from "@/lib/orders";
import type { Customer, Driver, Order, OrderStatus } from "@/lib/types";

export function OrderBoard({
  orders,
  customers,
  drivers,
  selectedId,
  draggingId,
  readOnly,
  activeStatus,
  onSelect,
  onDrag,
  onMove,
  onAdd,
}: {
  orders: Order[];
  customers: Customer[];
  drivers: Driver[];
  selectedId: string | null;
  draggingId: string | null;
  readOnly: boolean;
  activeStatus: OrderStatus | null;
  onSelect: (orderId: string) => void;
  onDrag: (orderId: string | null) => void;
  onMove: (orderId: string, status: OrderStatus) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {FUNNEL.map((status) => {
        const cards = orders.filter((order) => order.status === status);
        const sum = cards.reduce((total, order) => total + (order.price ?? 0), 0);
        return (
          <section
            key={status}
            id={`order-col-${status}`}
            className={`w-64 shrink-0 ${activeStatus === status ? "rounded-xl ring-2 ring-[#e6b325]/70" : ""}`}
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
            <div className="mb-3 flex items-start justify-between gap-2 px-1">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[status] }} />
                  <span className="truncate">{statusTitle(status)}</span>
                </h2>
                <p className="mt-1 text-xs text-[#98a2b3]">{formatSom(sum)}</p>
              </div>
              <span className="text-sm tabular-nums text-[#667085]">{cards.length}</span>
            </div>
            <div className="min-h-28 space-y-2">
              {status === "new" && !readOnly ? (
                <button type="button" onClick={onAdd} className="w-full rounded-xl border border-dashed border-[#d0d5dd] bg-white px-3 py-2 text-left text-sm text-[#52606d] hover:border-[#2e6db4]">
                  + Карточка клиента
                </button>
              ) : null}
              {cards.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#e6e8ec] px-3 py-8 text-center text-xs text-[#98a2b3]">Перетащите заказ сюда</p>
              ) : null}
              {cards.map((order) => {
                const customer = customers.find((item) => item.id === order.customerId);
                const driver = drivers.find((item) => item.id === order.driverId);
                const name = customer?.name || "Без имени";
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
                    className={`rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${selectedId === order.id ? "border-[#2e6db4]" : "border-[#e6e8ec]"}`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => onSelect(order.id)}>
                      <span className="flex items-start gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2f6] text-[11px] font-semibold uppercase text-[#667085]">{initials(name)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-[#1f2933]">{name}</span>
                            {order.status === "new" || order.priority === "high" ? (
                              <span className="shrink-0 rounded bg-[#fdecec] px-1.5 py-0.5 text-[10px] font-semibold text-[#c24141]">{order.priority === "high" ? "Срочно" : "Новый"}</span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[#98a2b3]">{order.pickup || ORDER_SOURCE_LABEL[order.source]}</span>
                        </span>
                      </span>
                      <span className="mt-3 flex items-end justify-between gap-2">
                        <span>
                          <span className="block text-sm font-semibold tabular-nums text-[#1f2933]">{order.price != null ? formatSom(order.price) : "—"}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-[#98a2b3]">{driver ? fullName(driver) : "водитель не назначен"}{order.hold ? ` · ${ORDER_HOLD_LABEL[order.hold]}` : ""}</span>
                        </span>
                      </span>
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

function formatSom(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} сом`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return parts.slice(0, 2).map((part) => part[0]).join("");
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
