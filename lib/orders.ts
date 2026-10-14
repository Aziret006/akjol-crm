import type { Customer, Driver, DriverDuty, Order, OrderHold, OrderPriority, OrderSource, OrderStatus, SourceKind } from "./types";

const ACTIVE: OrderStatus[] = ["assigned", "en_route", "in_progress"];
const QUEUE: OrderStatus[] = ["new", "processing", "awaiting_driver"];
const HOLDS: OrderHold[] = ["callback", "no_driver", "no_answer", "needs_admin", "await_confirm"];

export const FUNNEL: OrderStatus[] = ["new", "processing", "awaiting_driver", "assigned", "en_route", "in_progress", "done", "cancelled"];

export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["processing", "cancelled"],
  processing: ["awaiting_driver", "cancelled"],
  awaiting_driver: ["cancelled"],
  assigned: ["en_route", "cancelled"],
  en_route: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "processing",
  processing: "awaiting_driver",
  assigned: "en_route",
  en_route: "in_progress",
  in_progress: "done",
};

export function canDropStatus(from: OrderStatus, to: OrderStatus) {
  if (to === "cancelled" || to === "assigned" || to === from) return false;
  return STATUS_TRANSITIONS[from].includes(to);
}

function isHold(value: Order["hold"]): value is OrderHold {
  return Boolean(value && HOLDS.includes(value));
}

export function normalizeCustomer(input: Partial<Customer> & Pick<Customer, "id" | "name" | "phone">): Customer {
  return {
    id: input.id,
    name: input.name || "",
    phone: input.phone || "",
    city: input.city || "Бишкек",
    address: input.address || "",
    note: input.note || "",
  };
}

export function normalizeOrder(order: Order): Order {
  const hold = isHold(order.hold) ? order.hold : null;
  const priority: OrderPriority = order.priority === "high" ? "high" : "normal";
  return {
    ...order,
    priority,
    hold,
    callbackAt: typeof order.callbackAt === "string" ? order.callbackAt : null,
    vehicleNote: typeof order.vehicleNote === "string" ? order.vehicleNote : "",
  };
}

export function canSeeOrder(order: Order, userId: string, viewAll: boolean) {
  if (viewAll) return true;
  if (order.dispatcherId === userId) return true;
  return QUEUE.includes(order.status);
}

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function findCustomerByPhone(customers: Customer[], phone: string) {
  const digits = phoneDigits(phone);
  if (digits.length < 6) return null;
  return customers.find((customer) => phoneDigits(customer.phone) === digits) ?? null;
}

export function driverDuty(orders: Order[], driver: Driver, exceptOrderId?: string): DriverDuty {
  if (driver.availability === "offline") return "offline";
  const busy = orders.some(
    (order) =>
      order.driverId === driver.id &&
      order.id !== exceptOrderId &&
      ACTIVE.includes(order.status),
  );
  return busy ? "busy" : "available";
}

export function canAssignDriver(orders: Order[], driver: Driver, orderId: string) {
  return driverDuty(orders, driver, orderId) === "available";
}

export function nextOrderNumber(orders: Order[]) {
  return orders.reduce((max, order) => Math.max(max, order.number), 1000) + 1;
}

export function similarOpenOrder(orders: Order[], customers: Customer[], phone: string, pickup: string, now = Date.now()) {
  const digits = phoneDigits(phone);
  const place = pickup.trim().toLowerCase();
  const limit = now - 2 * 60 * 60 * 1000;
  return (
    orders.find((order) => {
      if (order.status === "done" || order.status === "cancelled") return false;
      if (new Date(order.createdAt).getTime() < limit) return false;
      const customer = customers.find((item) => item.id === order.customerId);
      return Boolean(customer && phoneDigits(customer.phone) === digits && order.pickup.trim().toLowerCase() === place);
    }) ?? null
  );
}

export function ordersNeedingAttention(orders: Order[], now = Date.now()) {
  const waitingLimit = now - 10 * 60 * 1000;
  return orders.filter((order) => {
    if (order.status === "done" || order.status === "cancelled") return false;
    if (order.hold === "needs_admin" || order.hold === "no_driver" || order.hold === "no_answer") return true;
    if (order.status === "new" || order.status === "processing") return true;
    return order.status === "awaiting_driver" && new Date(order.updatedAt || order.createdAt).getTime() <= waitingLimit;
  });
}

export function orderSourceFromConversation(source: SourceKind): OrderSource {
  if (source === "whatsapp" || source === "telegram" || source === "site") return source;
  return "other";
}

export function formatOrderNumber(number: number) {
  return `№${number}`;
}
