import type { PlatformPermission, PlatformRole } from "./types";

const ALL: PlatformPermission[] = [
  "platform.view",
  "companies.view",
  "companies.edit",
  "users.view",
  "users.edit",
  "plans.view",
  "plans.edit",
  "finance.view",
  "agents.view",
  "agents.control",
  "integrations.view",
  "integrations.control",
  "support.view",
  "support.reply",
  "notices.view",
  "journal.view",
  "roles.view",
];

const SUPPORT: PlatformPermission[] = [
  "platform.view",
  "companies.view",
  "users.view",
  "plans.view",
  "agents.view",
  "integrations.view",
  "support.view",
  "support.reply",
  "notices.view",
];

const FINANCE: PlatformPermission[] = [
  "platform.view",
  "companies.view",
  "plans.view",
  "finance.view",
  "notices.view",
  "journal.view",
];

export function platformAllows(role: PlatformRole, permission: PlatformPermission) {
  if (role === "owner" || role === "sysadmin") return true;
  if (role === "support") return SUPPORT.includes(permission);
  return FINANCE.includes(permission);
}

export const PLATFORM_PERMISSIONS = ALL;
