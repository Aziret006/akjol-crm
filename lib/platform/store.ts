import { promises as fs } from "fs";
import path from "path";
import { platformAllows } from "./access";
import { demoPlatform } from "./seed";
import type { PlatformAction, PlatformRole, PlatformState, Ticket } from "./types";

const filePath = path.join(process.cwd(), ".data", "platform.json");
let chain: Promise<void> = Promise.resolve();

function uid() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readFile(): Promise<PlatformState> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as PlatformState;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.companies)) return demoPlatform();
    const demo = demoPlatform();
    return {
      ...demo,
      ...parsed,
      version: 1,
      source: "demo",
      plans: Array.isArray(parsed.plans) ? parsed.plans : demo.plans,
      companies: parsed.companies,
      users: Array.isArray(parsed.users) ? parsed.users : demo.users,
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : demo.subscriptions,
      payments: Array.isArray(parsed.payments) ? parsed.payments : demo.payments,
      agents: Array.isArray(parsed.agents) ? parsed.agents : demo.agents,
      agentErrors: Array.isArray(parsed.agentErrors) ? parsed.agentErrors : demo.agentErrors,
      integrations: Array.isArray(parsed.integrations) ? parsed.integrations : demo.integrations,
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : demo.tickets,
      notices: Array.isArray(parsed.notices) ? parsed.notices : demo.notices,
      journal: Array.isArray(parsed.journal) ? parsed.journal : demo.journal,
      operators: Array.isArray(parsed.operators) ? parsed.operators : demo.operators,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const seed = demoPlatform();
      await writeFile(seed);
      return seed;
    }
    throw error;
  }
}

async function writeFile(state: PlatformState) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(temp, filePath);
}

export async function readPlatform() {
  return readFile();
}

export function operatorRole(state: PlatformState, userId: string): PlatformRole | null {
  return state.operators.find((item) => item.userId === userId)?.role ?? null;
}

type Actor = { id: string; name: string; role: PlatformRole };

export function runPlatform(actor: Actor, action: PlatformAction) {
  const run = chain.then(async () => {
    const current = await readFile();
    const next = apply(current, actor, action);
    await writeFile(next.state);
    return next;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function journal(state: PlatformState, actor: Actor, action: string, object: string, result: "ok" | "denied" | "error", reason: string): PlatformState {
  return {
    ...state,
    journal: [
      { id: uid(), actorId: actor.id, actorName: actor.name, action, object, result, reason, at: new Date().toISOString() },
      ...state.journal,
    ],
  };
}

function apply(state: PlatformState, actor: Actor, action: PlatformAction): { state: PlatformState; ok: boolean; error?: string } {
  const deny = (permission: Parameters<typeof platformAllows>[1], message: string) => {
    if (platformAllows(actor.role, permission)) return null;
    return { state: journal(state, actor, "Отказ", permission, "denied", message), ok: false, error: message };
  };

  if (action.type === "set-company-status") {
    const blocked = deny("companies.edit", "Недостаточно прав, чтобы менять доступ компании");
    if (blocked) return blocked;
    if (!action.reason.trim()) return { state, ok: false, error: "Укажите причину" };
    const company = state.companies.find((item) => item.id === action.companyId);
    if (!company) return { state, ok: false, error: "Компания не найдена" };
    return {
      ok: true,
      state: journal(
        { ...state, companies: state.companies.map((item) => (item.id === company.id ? { ...item, status: action.status } : item)) },
        actor,
        action.status === "suspended" ? "Приостановка компании" : action.status === "active" ? "Восстановление компании" : "Смена статуса компании",
        company.name,
        "ok",
        action.reason.trim(),
      ),
    };
  }

  if (action.type === "set-company-plan") {
    const blocked = deny("companies.edit", "Недостаточно прав, чтобы менять тариф");
    if (blocked) return blocked;
    if (!action.reason.trim()) return { state, ok: false, error: "Укажите причину смены тарифа" };
    const company = state.companies.find((item) => item.id === action.companyId);
    const plan = state.plans.find((item) => item.id === action.planId);
    if (!company || !plan) return { state, ok: false, error: "Компания или тариф не найдены" };
    return {
      ok: true,
      state: journal(
        {
          ...state,
          companies: state.companies.map((item) => (item.id === company.id ? { ...item, planId: plan.id } : item)),
          subscriptions: state.subscriptions.map((item) =>
            item.companyId === company.id
              ? { ...item, planId: plan.id, period: plan.period, amount: plan.price, status: plan.period === "trial" ? "trial" : item.status }
              : item,
          ),
        },
        actor,
        "Изменение тарифа",
        `${company.name} → ${plan.name}`,
        "ok",
        action.reason.trim(),
      ),
    };
  }

  if (action.type === "set-user-status") {
    const blocked = deny("users.edit", "Недостаточно прав, чтобы менять доступ пользователя");
    if (blocked) return blocked;
    if (!action.reason.trim()) return { state, ok: false, error: "Укажите причину" };
    const user = state.users.find((item) => item.id === action.userId);
    if (!user) return { state, ok: false, error: "Пользователь не найден" };
    return {
      ok: true,
      state: journal(
        { ...state, users: state.users.map((item) => (item.id === user.id ? { ...item, accountStatus: action.accountStatus } : item)) },
        actor,
        action.accountStatus === "blocked" ? "Блокировка пользователя" : "Восстановление пользователя",
        `${user.name} (${user.email})`,
        "ok",
        action.reason.trim(),
      ),
    };
  }

  if (action.type === "set-user-role") {
    const blocked = deny("users.edit", "Недостаточно прав, чтобы менять роль");
    if (blocked) return blocked;
    if (!action.reason.trim()) return { state, ok: false, error: "Укажите причину" };
    const user = state.users.find((item) => item.id === action.userId);
    if (!user) return { state, ok: false, error: "Пользователь не найден" };
    const role = action.role.trim();
    if (role.length < 2) return { state, ok: false, error: "Роль слишком короткая" };
    return {
      ok: true,
      state: journal(
        { ...state, users: state.users.map((item) => (item.id === user.id ? { ...item, role } : item)) },
        actor,
        "Изменение роли",
        `${user.name}: ${user.role} → ${role}`,
        "ok",
        action.reason.trim(),
      ),
    };
  }

  if (action.type === "save-plan") {
    const blocked = deny("plans.edit", "Недостаточно прав, чтобы менять тарифы");
    if (blocked) return blocked;
    const plan = action.plan;
    if (!plan.name.trim()) return { state, ok: false, error: "Укажите название тарифа" };
    if (plan.price < 0) return { state, ok: false, error: "Цена не может быть отрицательной" };
    const exists = state.plans.some((item) => item.id === plan.id);
    const plans = exists ? state.plans.map((item) => (item.id === plan.id ? plan : item)) : [...state.plans, { ...plan, id: plan.id || uid() }];
    return { ok: true, state: journal({ ...state, plans }, actor, exists ? "Тариф изменён" : "Тариф создан", plan.name, "ok", "") };
  }

  if (action.type === "set-agent-status") {
    const blocked = deny("agents.control", "Недостаточно прав для управления агентом");
    if (blocked) return blocked;
    const agent = state.agents.find((item) => item.id === action.agentId);
    if (!agent) return { state, ok: false, error: "Агент не найден" };
    return {
      ok: true,
      state: journal(
        { ...state, agents: state.agents.map((item) => (item.id === agent.id ? { ...item, status: action.status } : item)) },
        actor,
        "Статус AI-агента",
        `${agent.name} → ${action.status}`,
        "ok",
        "Сохранено в демо-хранилище. Облачный AI не подключён.",
      ),
    };
  }

  if (action.type === "set-integration") {
    const blocked = deny("integrations.control", "Недостаточно прав для интеграций");
    if (blocked) return blocked;
    const row = state.integrations.find((item) => item.id === action.integrationId);
    if (!row) return { state, ok: false, error: "Интеграция не найдена" };
    if (action.status === "connected") {
      return { state: journal(state, actor, "Подключение канала", row.id, "error", "WhatsApp и Telegram не подключены"), ok: false, error: "Канал не подключён: секреты WHATSAPP_* / Telegram пусты. Успешное подключение не имитируется." };
    }
    return {
      ok: true,
      state: journal(
        { ...state, integrations: state.integrations.map((item) => (item.id === row.id ? { ...item, status: action.status, lastError: action.status === "disconnected" ? "Отключено администратором" : item.lastError } : item)) },
        actor,
        "Отключение интеграции",
        `${row.kind} / ${row.companyId}`,
        "ok",
        "Подтверждено администратором",
      ),
    };
  }

  if (action.type === "check-integration") {
    const blocked = deny("integrations.view", "Недостаточно прав");
    if (blocked) return blocked;
    const row = state.integrations.find((item) => item.id === action.integrationId);
    if (!row) return { state, ok: false, error: "Интеграция не найдена" };
    const connected = Boolean(process.env.WHATSAPP_TOKEN?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim());
    const lastError = connected ? null : `${row.kind}: провайдер не задан в env`;
    return {
      ok: connected,
      error: lastError ?? undefined,
      state: journal(
        {
          ...state,
          integrations: state.integrations.map((item) =>
            item.id === row.id ? { ...item, lastSyncAt: new Date().toISOString(), lastError, status: connected ? item.status : "disconnected" } : item,
          ),
        },
        actor,
        "Проверка интеграции",
        row.id,
        connected ? "ok" : "error",
        lastError ?? "",
      ),
    };
  }

  if (action.type === "reply-ticket") {
    const blocked = deny("support.reply", "Недостаточно прав для ответа");
    if (blocked) return blocked;
    const text = action.text.trim();
    if (text.length < 2) return { state, ok: false, error: "Введите текст ответа" };
    const ticket = state.tickets.find((item) => item.id === action.ticketId);
    if (!ticket) return { state, ok: false, error: "Обращение не найдено" };
    const now = new Date().toISOString();
    const next: Ticket = {
      ...ticket,
      status: ticket.status === "new" ? "in_progress" : ticket.status,
      lastReplyAt: now,
      messages: [...ticket.messages, { id: uid(), author: actor.name, staff: true, text, at: now }],
    };
    return {
      ok: true,
      state: journal(
        { ...state, tickets: state.tickets.map((item) => (item.id === ticket.id ? next : item)) },
        actor,
        "Ответ в поддержку",
        `№${ticket.number}`,
        "ok",
        "",
      ),
    };
  }

  if (action.type === "set-ticket") {
    const blocked = deny("support.reply", "Недостаточно прав");
    if (blocked) return blocked;
    const ticket = state.tickets.find((item) => item.id === action.ticketId);
    if (!ticket) return { state, ok: false, error: "Обращение не найдено" };
    const next = {
      ...ticket,
      status: action.status ?? ticket.status,
      priority: action.priority ?? ticket.priority,
      assignee: action.assignee === undefined ? ticket.assignee : action.assignee,
    };
    return { ok: true, state: journal({ ...state, tickets: state.tickets.map((item) => (item.id === ticket.id ? next : item)) }, actor, "Обращение обновлено", `№${ticket.number}`, "ok", "") };
  }

  if (action.type === "read-notice") {
    const blocked = deny("notices.view", "Недостаточно прав");
    if (blocked) return blocked;
    return {
      ok: true,
      state: {
        ...state,
        notices: state.notices.map((item) => (action.noticeId === "all" || item.id === action.noticeId ? { ...item, read: true } : item)),
      },
    };
  }

  if (action.type === "revoke-sessions") {
    const blocked = deny("users.edit", "Недостаточно прав");
    if (blocked) return blocked;
    const user = state.users.find((item) => item.id === action.userId);
    return {
      state: journal(state, actor, "Отзыв сессий", user?.email ?? action.userId, "error", "Сервер сессий не подключён"),
      ok: false,
      error: "Активные сессии на сервере не хранятся. Отозвать их нельзя.",
    };
  }

  return { state, ok: false, error: "Неизвестное действие" };
}
