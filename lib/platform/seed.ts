import type { PlatformState } from "./types";

export function emptyPlatform(): PlatformState {
  return {
    version: 1,
    source: "demo",
    plans: [],
    companies: [],
    users: [],
    subscriptions: [],
    payments: [],
    agents: [],
    agentErrors: [],
    integrations: [],
    tickets: [],
    notices: [],
    journal: [],
    operators: [{ userId: "u-admin", role: "owner" }],
  };
}

export function demoPlatform(): PlatformState {
  return {
    version: 1,
    source: "demo",
    operators: [{ userId: "u-admin", role: "owner" }],
    plans: [
      { id: "p-trial", name: "Пробный", description: "14 дней на проверку CRM", price: 0, currency: "KGS", period: "trial", staffLimit: 3, channelLimit: 1, features: ["Заказы", "Чаты"], aiDialogLimit: 50, available: true },
      { id: "p-start", name: "Старт", description: "Небольшой парк", price: 4900, currency: "KGS", period: "month", staffLimit: 8, channelLimit: 2, features: ["Заказы", "Чаты", "Смены"], aiDialogLimit: 500, available: true },
      { id: "p-biz", name: "Бизнес", description: "Несколько филиалов", price: 39000, currency: "KGS", period: "year", staffLimit: 30, channelLimit: 6, features: ["Заказы", "Чаты", "Смены", "Аналитика"], aiDialogLimit: 5000, available: true },
      { id: "p-custom", name: "Индивидуальный", description: "По договору", price: 0, currency: "KGS", period: "custom", staffLimit: 99, channelLimit: 12, features: ["По согласованию"], aiDialogLimit: 0, available: true },
    ],
    companies: [
      { id: "c-akjol", name: "Акжол Таксопарк", phone: "+996 770 00 47 99", email: "park@akjol.kg", city: "Бишкек", status: "active", planId: "p-start", ownerUserId: "tu-azamat", createdAt: "2026-08-01T08:00:00+06:00", note: "демо-арендатор, не связан с заказами этой CRM", demo: true },
      { id: "c-naryn", name: "Нарын Трансфер", phone: "+996 555 10 20 30", email: "hello@naryn-demo.kg", city: "Нарын", status: "trial", planId: "p-trial", ownerUserId: "tu-aida", createdAt: "2026-10-10T11:20:00+06:00", note: "демо", demo: true },
      { id: "c-osh", name: "Ош Лайн", phone: "+996 777 44 55 66", email: "pay@oshline-demo.kg", city: "Ош", status: "awaiting_payment", planId: "p-start", ownerUserId: "tu-bek", createdAt: "2026-07-20T09:10:00+06:00", note: "демо", demo: true },
      { id: "c-talas", name: "Талас Драйв", phone: "+996 700 12 12 12", email: "info@talas-demo.kg", city: "Талас", status: "suspended", planId: "p-biz", ownerUserId: "tu-mira", createdAt: "2026-06-12T14:00:00+06:00", note: "демо", demo: true },
      { id: "c-old", name: "Каракол Сервис", phone: "+996 509 00 11 22", email: "closed@karakol-demo.kg", city: "Каракол", status: "closed", planId: "p-start", ownerUserId: "tu-old", createdAt: "2026-04-03T10:00:00+06:00", note: "демо", demo: true },
    ],
    users: [
      { id: "tu-azamat", companyId: "c-akjol", name: "Азамат Токтогулов", email: "azamat@akjol.kg", phone: "+996 700 11 22 01", role: "Владелец", accountStatus: "active", createdAt: "2026-08-01T08:00:00+06:00", lastSeenAt: "2026-10-14T09:40:00+06:00" },
      { id: "tu-aigul", companyId: "c-akjol", name: "Айгуль Сатыбалдиева", email: "aigul@akjol.kg", phone: "+996 700 11 22 02", role: "Диспетчер", accountStatus: "active", createdAt: "2026-08-04T10:00:00+06:00", lastSeenAt: "2026-10-14T08:15:00+06:00" },
      { id: "tu-aida", companyId: "c-naryn", name: "Аида Жунусова", email: "aida@naryn-demo.kg", phone: "+996 555 10 20 31", role: "Владелец", accountStatus: "active", createdAt: "2026-10-10T11:20:00+06:00", lastSeenAt: "2026-10-13T19:00:00+06:00" },
      { id: "tu-bek", companyId: "c-osh", name: "Бекзат Осмонов", email: "bek@oshline-demo.kg", phone: "+996 777 44 55 67", role: "Владелец", accountStatus: "active", createdAt: "2026-07-20T09:10:00+06:00", lastSeenAt: "2026-10-12T16:22:00+06:00" },
      { id: "tu-mira", companyId: "c-talas", name: "Мира Садыкова", email: "mira@talas-demo.kg", phone: "+996 700 12 12 13", role: "Владелец", accountStatus: "blocked", createdAt: "2026-06-12T14:00:00+06:00", lastSeenAt: "2026-09-30T12:00:00+06:00" },
      { id: "tu-old", companyId: "c-old", name: "Данияр К.", email: "closed@karakol-demo.kg", phone: "+996 509 00 11 23", role: "Владелец", accountStatus: "blocked", createdAt: "2026-04-03T10:00:00+06:00", lastSeenAt: null },
    ],
    subscriptions: [
      { id: "s-akjol", companyId: "c-akjol", planId: "p-start", period: "month", status: "active", startedAt: "2026-09-14T00:00:00+06:00", endsAt: "2026-10-14T00:00:00+06:00", amount: 4900, paid: true },
      { id: "s-naryn", companyId: "c-naryn", planId: "p-trial", period: "trial", status: "expiring", startedAt: "2026-10-10T00:00:00+06:00", endsAt: "2026-10-24T00:00:00+06:00", amount: 0, paid: true },
      { id: "s-osh", companyId: "c-osh", planId: "p-start", period: "month", status: "overdue", startedAt: "2026-09-01T00:00:00+06:00", endsAt: "2026-10-01T00:00:00+06:00", amount: 4900, paid: false },
      { id: "s-talas", companyId: "c-talas", planId: "p-biz", period: "year", status: "cancelled", startedAt: "2026-06-12T00:00:00+06:00", endsAt: "2026-09-30T00:00:00+06:00", amount: 39000, paid: true },
      { id: "s-old", companyId: "c-old", planId: "p-start", period: "month", status: "cancelled", startedAt: "2026-04-03T00:00:00+06:00", endsAt: "2026-05-03T00:00:00+06:00", amount: 4900, paid: true },
    ],
    payments: [
      { id: "pay-1", companyId: "c-akjol", planId: "p-start", amount: 4900, currency: "KGS", at: "2026-09-14T10:12:00+06:00", method: "transfer", status: "paid", providerRef: null, note: "демо-запись: платёжный сервис не подключён" },
      { id: "pay-2", companyId: "c-akjol", planId: "p-start", amount: 4900, currency: "KGS", at: "2026-10-13T09:05:00+06:00", method: "transfer", status: "pending", providerRef: null, note: "демо-запись, оплата не подтверждена провайдером" },
      { id: "pay-3", companyId: "c-osh", planId: "p-start", amount: 4900, currency: "KGS", at: "2026-10-02T18:40:00+06:00", method: "card", status: "failed", providerRef: null, note: "демо-запись: провайдер не вызывался" },
      { id: "pay-4", companyId: "c-talas", planId: "p-biz", amount: 39000, currency: "KGS", at: "2026-06-12T15:00:00+06:00", method: "bank", status: "paid", providerRef: null, note: "демо-запись" },
      { id: "pay-5", companyId: "c-talas", planId: "p-biz", amount: 39000, currency: "KGS", at: "2026-09-30T12:00:00+06:00", method: "bank", status: "refunded", providerRef: null, note: "демо-возврат, деньги никуда не уходили" },
    ],
    agents: [
      { id: "ag-1", companyId: "c-akjol", name: "Акжол ассистент", status: "setup", channels: ["whatsapp"], dialogs: 0, errors: 0, lastActiveAt: null, configNote: "AI не подключён. Это демо-карточка." },
      { id: "ag-2", companyId: "c-naryn", name: "Нарын бот", status: "offline", channels: [], dialogs: 0, errors: 0, lastActiveAt: null, configNote: "демо" },
      { id: "ag-3", companyId: "c-osh", name: "Ош линия", status: "error", channels: ["telegram"], dialogs: 12, errors: 4, lastActiveAt: "2026-10-11T21:00:00+06:00", configNote: "демо: ошибка канала" },
    ],
    agentErrors: [
      { id: "ae-1", agentId: "ag-3", at: "2026-10-11T21:00:00+06:00", text: "Telegram webhook не ответил (демо-журнал, провайдер не вызывался)" },
    ],
    integrations: [
      { id: "in-1", companyId: "c-akjol", kind: "whatsapp", status: "disconnected", connectedAt: null, lastSyncAt: null, lastError: "WHATSAPP_* не заданы", autoReplies: false },
      { id: "in-2", companyId: "c-akjol", kind: "telegram", status: "disconnected", connectedAt: null, lastSyncAt: null, lastError: "Telegram не подключён", autoReplies: false },
      { id: "in-3", companyId: "c-osh", kind: "telegram", status: "error", connectedAt: "2026-07-21T10:00:00+06:00", lastSyncAt: "2026-10-11T21:00:00+06:00", lastError: "демо: токен отозван", autoReplies: true },
      { id: "in-4", companyId: "c-naryn", kind: "whatsapp", status: "pending", connectedAt: null, lastSyncAt: null, lastError: null, autoReplies: false },
    ],
    tickets: [
      {
        id: "t-1",
        number: 2401,
        companyId: "c-osh",
        userId: "tu-bek",
        subject: "Не проходит оплата тарифа",
        category: "Оплата",
        priority: "high",
        status: "new",
        assignee: null,
        createdAt: "2026-10-13T16:40:00+06:00",
        lastReplyAt: "2026-10-13T16:40:00+06:00",
        messages: [{ id: "tm-1", author: "Бекзат Осмонов", staff: false, text: "Счёт не оплачивается, парк ждёт доступ.", at: "2026-10-13T16:40:00+06:00" }],
      },
      {
        id: "t-2",
        number: 2398,
        companyId: "c-naryn",
        userId: "tu-aida",
        subject: "Как подключить WhatsApp",
        category: "Интеграции",
        priority: "normal",
        status: "in_progress",
        assignee: "Азамат Токтогулов",
        createdAt: "2026-10-12T11:00:00+06:00",
        lastReplyAt: "2026-10-12T12:10:00+06:00",
        messages: [
          { id: "tm-2", author: "Аида Жунусова", staff: false, text: "Нужна инструкция по WhatsApp.", at: "2026-10-12T11:00:00+06:00" },
          { id: "tm-3", author: "Азамат Токтогулов", staff: true, text: "Cloud API ещё не подключён. Пока заявки принимаем вручную.", at: "2026-10-12T12:10:00+06:00" },
        ],
      },
    ],
    notices: [
      { id: "n-1", category: "Подписка", level: "warning", title: "Пробный период Нарын Трансфер", text: "Заканчивается 24.10.2026", at: "2026-10-14T08:00:00+06:00", href: "/platform/companies?id=c-naryn", read: false },
      { id: "n-2", category: "Оплата", level: "critical", title: "Неуспешный платёж Ош Лайн", text: "демо-запись, провайдер не вызывался", at: "2026-10-02T18:40:00+06:00", href: "/platform/finance", read: false },
      { id: "n-3", category: "Интеграция", level: "warning", title: "Telegram Ош Лайн", text: "демо: токен отозван", at: "2026-10-11T21:00:00+06:00", href: "/platform/integrations", read: false },
      { id: "n-4", category: "Поддержка", level: "info", title: "Новое обращение №2401", text: "Не проходит оплата тарифа", at: "2026-10-13T16:40:00+06:00", href: "/platform/support?id=t-1", read: false },
    ],
    journal: [
      { id: "j-1", actorId: "u-admin", actorName: "Азамат Токтогулов", action: "Создана демо-панель платформы", object: "хранилище .data/platform.json", result: "ok", reason: "Первый запуск", at: "2026-10-14T08:00:00+06:00" },
    ],
  };
}
