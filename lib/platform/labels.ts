import type {
  AgentStatus,
  CompanyStatus,
  IntegrationStatus,
  PaymentStatus,
  PlanPeriod,
  PlatformRole,
  SubscriptionStatus,
  TicketPriority,
  TicketStatus,
} from "./types";

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  active: "Активна",
  trial: "Пробный период",
  awaiting_payment: "Ожидает оплаты",
  suspended: "Приостановлена",
  closed: "Закрыта",
};

export const PERIOD_LABEL: Record<PlanPeriod, string> = {
  trial: "Пробный период",
  month: "Месячная",
  year: "Годовая",
  custom: "Индивидуальный",
};

export const SUB_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Пробная",
  active: "Активная",
  expiring: "Скоро истекает",
  overdue: "Просрочена",
  cancelled: "Отменена",
};

export const PAY_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Оплачен",
  pending: "Ожидает",
  failed: "Неуспешный",
  refunded: "Возврат",
};

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  active: "Активен",
  stopped: "Остановлен",
  setup: "Настраивается",
  error: "Ошибка",
  offline: "Не подключён",
};

export const CHANNEL_LABEL: Record<"whatsapp" | "telegram", string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

export const INTEGRATION_STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Подключена",
  error: "Ошибка",
  disconnected: "Отключена",
  pending: "Ожидает",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  new: "Новое",
  in_progress: "В работе",
  waiting_client: "Ожидает клиента",
  resolved: "Решено",
  closed: "Закрыто",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
};

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  owner: "Владелец платформы",
  sysadmin: "Системный администратор",
  support: "Менеджер поддержки",
  finance: "Финансовый менеджер",
};

export function money(amount: number, currency = "сом") {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ${currency}`;
}
