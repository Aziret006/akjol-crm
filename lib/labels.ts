import type { AccountStatus, ChannelKind, RequestStatus, Role, SourceKind, WorkStatus } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Администратор",
  dispatcher: "Диспетчер",
};

export const ACCOUNT_LABEL: Record<AccountStatus, string> = {
  active: "Активен",
  blocked: "Заблокирован",
};

export const WORK_LABEL: Record<WorkStatus, string> = {
  idle: "Не на смене",
  working: "На работе",
  away: "Отошёл",
  finished: "Закончил",
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  site: "Сайт",
  ads: "Реклама",
  referral: "Рекомендация",
  other: "Другой источник",
  unknown: "Не определён",
};

export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  site: "Сайт",
  manual: "Вручную",
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  new: "Новое",
  in_progress: "В работе",
  waiting: "Ожидает",
  done: "Закрыто",
};

export const EVENT_LABEL = {
  arrived: "Пришёл",
  away: "Отошёл",
  returned: "Вернулся",
  finished: "Закончил",
} as const;

export const SOURCE_OPTIONS = Object.keys(SOURCE_LABEL) as SourceKind[];

export function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`;
}
