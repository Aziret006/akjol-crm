import type {
  AccountStatus,
  ChannelKind,
  DriverDuty,
  OrderSource,
  OrderHold,
  OrderStatus,
  PaymentMethod,
  RequestStatus,
  Role,
  SourceKind,
  WorkStatus,
} from "./types";

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

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  phone: "Телефонный звонок",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  site: "Сайт",
  other: "Другое",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Новый заказ",
  processing: "Обработка",
  awaiting_driver: "Поиск водителя",
  assigned: "Водитель назначен",
  en_route: "Едет к клиенту",
  in_progress: "Поездка началась",
  done: "Завершён",
  cancelled: "Отменён",
};

export const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  processing: "В обработку",
  awaiting_driver: "Искать водителя",
  en_route: "Едет к клиенту",
  in_progress: "Поездка началась",
  done: "Завершить",
};

export const ORDER_HOLD_LABEL: Record<OrderHold, string> = {
  callback: "Повторный звонок",
  no_driver: "Нет свободного водителя",
  no_answer: "Клиент не отвечает",
  needs_admin: "Нужен администратор",
  await_confirm: "Ждёт подтверждения",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
};

export const DRIVER_DUTY_LABEL: Record<DriverDuty, string> = {
  available: "Доступен",
  busy: "Занят",
  offline: "Не на линии",
};

export const DESK_STATUS_LABEL = {
  off_shift: "Не на смене",
  available: "Доступен для звонков",
  talking: "Разговаривает",
  break: "Перерыв",
  finished: "Завершил смену",
} as const;

export const ORDER_SOURCE_OPTIONS = Object.keys(ORDER_SOURCE_LABEL) as OrderSource[];

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
