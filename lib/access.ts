import type { Role } from "./types";

export type Permission =
  | "orders.view_all"
  | "orders.view_assigned"
  | "orders.create"
  | "orders.edit"
  | "orders.cancel"
  | "orders.assign_driver"
  | "orders.reassign_dispatcher"
  | "orders.reopen"
  | "audit.view"
  | "drivers.view_all"
  | "drivers.edit"
  | "drivers.delete"
  | "recruitment.view";

const DISPATCHER: Permission[] = [
  "orders.view_assigned",
  "orders.create",
  "orders.edit",
  "orders.cancel",
  "orders.assign_driver",
  "drivers.edit",
];

export function allows(role: Role, permission: Permission) {
  if (role === "admin") return true;
  return DISPATCHER.includes(permission);
}
