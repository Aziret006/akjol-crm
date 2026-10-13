"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { currentStatus, nextEventType, openShift } from "./attendance";
import { fullName, SOURCE_LABEL } from "./labels";
import { createSeed } from "./seed";
import { isoAt, sha256 } from "./time";
import type {
  AccountStatus,
  ActionResult,
  AttendanceType,
  CrmState,
  RequestStatus,
  Role,
  SourceKind,
  User,
} from "./types";

const STORAGE_KEY = "akjol-crm-frontend-v1";

const EMPTY_STATE: CrmState = {
  version: 1,
  users: [],
  events: [],
  corrections: [],
  customers: [],
  conversations: [],
  messages: [],
  sourceChanges: [],
  notes: [],
  audit: [],
  session: null,
};

export type UserInput = {
  id?: string;
  firstName: string;
  lastName: string;
  login: string;
  password?: string;
  role: Role;
  accountStatus: AccountStatus;
  scheduleStart: string | null;
};

type CrmApi = {
  ready: boolean;
  now: number;
  state: CrmState;
  actor: User | null;
  user: User | null;
  viewing: boolean;
  readOnly: boolean;
  isAdmin: boolean;
  login: (login: string, password: string) => Promise<ActionResult>;
  logout: () => void;
  viewAs: (userId: string) => ActionResult;
  stopViewAs: () => void;
  punch: (type: "arrived" | "away" | "finished", confirm?: boolean) => ActionResult;
  correctEvent: (eventId: string, date: string, time: string, reason: string) => ActionResult;
  saveUser: (input: UserInput) => Promise<ActionResult>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<ActionResult>;
  setRole: (userId: string, role: Role) => ActionResult;
  setAccountStatus: (userId: string, status: AccountStatus) => ActionResult;
  sendMessage: (conversationId: string, text: string, fileName?: string) => ActionResult;
  assignConversation: (conversationId: string, assigneeId: string | null) => ActionResult;
  setRequestStatus: (conversationId: string, status: RequestStatus) => ActionResult;
  setSource: (conversationId: string, source: SourceKind, reason: string) => ActionResult;
  addNote: (conversationId: string, text: string) => ActionResult;
  markRead: (conversationId: string) => void;
  resetDemo: () => void;
};

const CrmContext = createContext<CrmApi | null>(null);

function ok(): ActionResult {
  return { ok: true };
}

function fail(error: string, code?: "confirm-finish"): ActionResult {
  return { ok: false, error, code };
}

function uid() {
  return crypto.randomUUID();
}

function withAudit(
  state: CrmState,
  actorId: string | null,
  action: string,
  detail: string,
  targetType: string,
  targetId: string,
): CrmState {
  return {
    ...state,
    audit: [
      { id: uid(), actorId, action, detail, targetType, targetId, at: new Date().toISOString() },
      ...state.audit,
    ],
  };
}

function loadState(): CrmState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeed();
    const parsed = JSON.parse(raw) as CrmState;
    if (parsed.version !== 1 || !Array.isArray(parsed.users) || parsed.users.length === 0) return createSeed();
    return parsed;
  } catch {
    return createSeed();
  }
}

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CrmState>(EMPTY_STATE);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const stateRef = useRef<CrmState>(EMPTY_STATE);
  stateRef.current = state;

  useEffect(() => {
    setState(loadState());
    setNow(Date.now());
    setReady(true);
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  const api = useMemo<CrmApi>(() => {
    const actor = state.session ? state.users.find((item) => item.id === state.session?.userId) ?? null : null;
    const viewing = Boolean(actor?.role === "admin" && state.session?.viewAsUserId);
    const user = viewing
      ? state.users.find((item) => item.id === state.session?.viewAsUserId) ?? actor
      : actor;

    const requireState = () => stateRef.current ?? state;

    return {
      ready,
      now,
      state,
      actor,
      user,
      viewing,
      readOnly: viewing,
      isAdmin: actor?.role === "admin" && !viewing,
      async login(loginName, password) {
        const current = requireState();
        const hash = await sha256(password.trim());
        const found = current.users.find((item) => item.login.toLowerCase() === loginName.trim().toLowerCase());
        if (!found || found.passwordHash !== hash) return fail("Неверный логин или пароль");
        if (found.accountStatus === "blocked") return fail("Аккаунт заблокирован. Обратитесь к администратору.");
        setState(
          withAudit(
            { ...current, session: { userId: found.id, viewAsUserId: null } },
            found.id,
            "Вход",
            fullName(found),
            "session",
            found.id,
          ),
        );
        return ok();
      },
      logout() {
        const current = requireState();
        if (!current.session || !actor) return;
        setState(
          withAudit(
            { ...current, session: null },
            actor.id,
            "Выход",
            fullName(actor),
            "session",
            actor.id,
          ),
        );
      },
      viewAs(userId) {
        const current = requireState();
        if (!actor || actor.role !== "admin") return fail("Недостаточно прав");
        if (actor.id === userId) return fail("Нельзя открыть собственный аккаунт в режиме просмотра");
        const target = current.users.find((item) => item.id === userId);
        if (!target) return fail("Сотрудник не найден");
        setState(
          withAudit(
            { ...current, session: { userId: actor.id, viewAsUserId: target.id } },
            actor.id,
            "Просмотр интерфейса сотрудника",
            `${fullName(actor)} открыл рабочий интерфейс ${fullName(target)} без пароля`,
            "user",
            target.id,
          ),
        );
        return ok();
      },
      stopViewAs() {
        const current = requireState();
        if (!actor || !current.session?.viewAsUserId) return;
        const target = current.users.find((item) => item.id === current.session?.viewAsUserId);
        setState(
          withAudit(
            { ...current, session: { userId: actor.id, viewAsUserId: null } },
            actor.id,
            "Выход из просмотра",
            target ? fullName(target) : "сотрудник",
            "user",
            current.session.viewAsUserId,
          ),
        );
      },
      punch(type, confirm = false) {
        const current = requireState();
        if (!actor || !user) return fail("Нужно войти");
        if (viewing) return fail("В режиме просмотра отметки недоступны");
        if (actor.id !== user.id) return fail("Недостаточно прав");
        const status = currentStatus(current.events, user.id);
        if (type === "arrived" && (status === "working")) return fail("Смена уже начата");
        if (type === "away" && status !== "working") return fail("Отойти можно только со статуса «На работе»");
        if (type === "finished" && status === "idle") return fail("Смена ещё не начата");
        if (type === "finished" && status === "finished") return fail("Смена уже завершена");
        if (type === "finished" && status === "away" && !confirm) {
          return fail("Сейчас статус «Отошёл». Подтвердите завершение смены.", "confirm-finish");
        }
        if (type === "arrived" && status !== "away" && openShift(current.events, user.id)) {
          return fail("Сначала завершите текущую смену");
        }
        const eventType: AttendanceType = nextEventType(status, type);
        const shiftId =
          eventType === "arrived"
            ? `shift-${user.id}-${uid().slice(0, 8)}`
            : openShift(current.events, user.id)?.shiftId ?? `shift-${user.id}-${uid().slice(0, 8)}`;
        const event = {
          id: uid(),
          userId: user.id,
          shiftId,
          type: eventType,
          at: new Date().toISOString(),
        };
        setState({ ...current, events: [...current.events, event] });
        return ok();
      },
      correctEvent(eventId, date, time, reason) {
        const current = requireState();
        if (!actor || actor.role !== "admin" || viewing) return fail("Исправлять отметки может только администратор");
        const cleanReason = reason.trim();
        if (cleanReason.length < 3) return fail("Укажите причину исправления");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return fail("Некорректные дата или время");
        const event = current.events.find((item) => item.id === eventId);
        if (!event) return fail("Отметка не найдена");
        const nextAt = isoAt(date, time);
        const shiftEvents = current.events
          .filter((item) => item.shiftId === event.shiftId)
          .sort((a, b) => a.at.localeCompare(b.at));
        const index = shiftEvents.findIndex((item) => item.id === event.id);
        const prev = shiftEvents[index - 1];
        const next = shiftEvents[index + 1];
        if (prev && nextAt <= prev.at) return fail("Время должно быть позже предыдущей отметки");
        if (next && nextAt >= next.at) return fail("Время должно быть раньше следующей отметки");
        const employee = current.users.find((item) => item.id === event.userId);
        const corrected = {
          ...current,
          events: current.events.map((item) => (item.id === eventId ? { ...item, at: nextAt } : item)),
          corrections: [
            {
              id: uid(),
              eventId,
              userId: event.userId,
              actorId: actor.id,
              previousAt: event.at,
              nextAt,
              reason: cleanReason,
              at: new Date().toISOString(),
            },
            ...current.corrections,
          ],
        };
        setState(
          withAudit(
            corrected,
            actor.id,
            "Корректировка рабочего времени",
            `${employee ? fullName(employee) : "Сотрудник"}: ${cleanReason}`,
            "attendance",
            eventId,
          ),
        );
        return ok();
      },
      async changePassword(currentPassword, nextPassword) {
        const current = requireState();
        const live = current.users.find((item) => item.id === actor?.id);
        if (!live || viewing) return fail("Недостаточно прав");
        if ((await sha256(currentPassword.trim())) !== live.passwordHash) return fail("Текущий пароль неверный");
        const next = nextPassword.trim();
        if (next.length < 5) return fail("Пароль не короче 5 символов");
        const passwordHash = await sha256(next);
        setState(
          withAudit(
            { ...current, users: current.users.map((item) => (item.id === live.id ? { ...item, passwordHash } : item)) },
            live.id,
            "Пароль изменён",
            fullName(live),
            "user",
            live.id,
          ),
        );
        return ok();
      },
      async saveUser(input) {
        const current = requireState();
        if (!actor || actor.role !== "admin" || viewing) return fail("Недостаточно прав");
        const firstName = input.firstName.trim();
        const lastName = input.lastName.trim();
        const loginName = input.login.trim().toLowerCase();
        if (firstName.length < 2 || lastName.length < 2) return fail("Укажите имя и фамилию");
        if (!/^[a-z0-9._-]{3,32}$/i.test(loginName)) return fail("Логин: 3–32 символа, латиница, цифры, . _ -");
        const duplicate = current.users.some(
          (item) => item.login.toLowerCase() === loginName && item.id !== input.id,
        );
        if (duplicate) return fail("Такой логин уже есть");
        const schedule = input.scheduleStart?.trim() || null;
        if (schedule && !/^\d{2}:\d{2}$/.test(schedule)) return fail("График укажите как ЧЧ:ММ");
        if (input.id) {
          const existing = current.users.find((item) => item.id === input.id);
          if (!existing) return fail("Сотрудник не найден");
          if (existing.id === actor.id && input.role !== "admin") return fail("Нельзя снять с себя роль администратора");
          if (existing.id === actor.id && input.accountStatus === "blocked") return fail("Нельзя заблокировать свой аккаунт");
          let passwordHash = existing.passwordHash;
          if (input.password?.trim()) {
            if (input.password.trim().length < 5) return fail("Пароль не короче 5 символов");
            passwordHash = await sha256(input.password.trim());
          }
          const updated: User = {
            ...existing,
            firstName,
            lastName,
            login: loginName,
            passwordHash,
            role: input.role,
            accountStatus: input.accountStatus,
            scheduleStart: schedule,
          };
          setState(
            withAudit(
              { ...current, users: current.users.map((item) => (item.id === updated.id ? updated : item)) },
              actor.id,
              "Сотрудник изменён",
              `${fullName(updated)}, роль ${input.role === "admin" ? "администратор" : "диспетчер"}`,
              "user",
              updated.id,
            ),
          );
          return ok();
        }
        if (!input.password || input.password.trim().length < 5) return fail("Задайте пароль не короче 5 символов");
        const passwordHash = await sha256(input.password.trim());
        const created: User = {
          id: uid(),
          firstName,
          lastName,
          login: loginName,
          passwordHash,
          role: input.role,
          accountStatus: input.accountStatus,
          createdAt: new Date().toISOString(),
          scheduleStart: schedule,
        };
        setState(
          withAudit(
            { ...current, users: [...current.users, created] },
            actor.id,
            "Сотрудник создан",
            `${fullName(created)}, роль ${created.role === "admin" ? "администратор" : "диспетчер"}`,
            "user",
            created.id,
          ),
        );
        return ok();
      },
      setRole(userId, role) {
        const current = requireState();
        if (!actor || actor.role !== "admin" || viewing) return fail("Недостаточно прав");
        if (userId === actor.id && role !== "admin") return fail("Нельзя снять с себя роль администратора");
        const target = current.users.find((item) => item.id === userId);
        if (!target) return fail("Сотрудник не найден");
        if (target.role === role) return ok();
        setState(
          withAudit(
            {
              ...current,
              users: current.users.map((item) => (item.id === userId ? { ...item, role } : item)),
            },
            actor.id,
            "Роль изменена",
            `${fullName(target)}: ${role === "admin" ? "администратор" : "диспетчер"}`,
            "user",
            userId,
          ),
        );
        return ok();
      },
      setAccountStatus(userId, status) {
        const current = requireState();
        if (!actor || actor.role !== "admin" || viewing) return fail("Недостаточно прав");
        if (userId === actor.id && status === "blocked") return fail("Нельзя заблокировать свой аккаунт");
        const target = current.users.find((item) => item.id === userId);
        if (!target) return fail("Сотрудник не найден");
        setState(
          withAudit(
            {
              ...current,
              users: current.users.map((item) => (item.id === userId ? { ...item, accountStatus: status } : item)),
            },
            actor.id,
            status === "blocked" ? "Аккаунт заблокирован" : "Аккаунт активирован",
            fullName(target),
            "user",
            userId,
          ),
        );
        return ok();
      },
      sendMessage(conversationId, text, fileName) {
        const current = requireState();
        if (!actor || viewing) return fail("В режиме просмотра отправка недоступна");
        const conversation = current.conversations.find((item) => item.id === conversationId);
        if (!conversation) return fail("Обращение не найдено");
        const allowed =
          actor.role === "admin" || conversation.assigneeId === actor.id || conversation.assigneeId === null;
        if (!allowed) return fail("Это обращение вам не назначено");
        const body = text.trim();
        if (!body && !fileName) return fail("Введите сообщение");
        const fileLine = fileName ? `[файл: ${fileName} — не отправлен в WhatsApp]` : "";
        const finalText = [body, fileLine].filter(Boolean).join("\n");
        const assigneeId = conversation.assigneeId ?? actor.id;
        const assignedNow = conversation.assigneeId == null;
        let next = {
          ...current,
          messages: [
            ...current.messages,
            {
              id: uid(),
              conversationId,
              direction: "out" as const,
              authorId: actor.id,
              text: finalText,
              at: new Date().toISOString(),
              delivery: "local" as const,
            },
          ],
          conversations: current.conversations.map((item) =>
            item.id === conversationId
              ? {
                  ...item,
                  assigneeId,
                  unread: 0,
                  updatedAt: new Date().toISOString(),
                  status: item.status === "new" ? ("in_progress" as const) : item.status,
                }
              : item,
          ),
        };
        if (assignedNow) {
          next = withAudit(
            next,
            actor.id,
            "Назначен ответственный",
            `${fullName(actor)} взял обращение`,
            "conversation",
            conversationId,
          );
        }
        setState(next);
        return ok();
      },
      assignConversation(conversationId, assigneeId) {
        const current = requireState();
        if (!actor || viewing) return fail("Недостаточно прав");
        if (actor.role !== "admin" && actor.role !== "dispatcher") return fail("Недостаточно прав");
        const conversation = current.conversations.find((item) => item.id === conversationId);
        if (!conversation) return fail("Обращение не найдено");
        if (actor.role === "dispatcher" && conversation.assigneeId && conversation.assigneeId !== actor.id) {
          return fail("Чужое обращение передать нельзя");
        }
        const target = assigneeId ? current.users.find((item) => item.id === assigneeId) : null;
        if (assigneeId && (!target || target.role !== "dispatcher" || target.accountStatus !== "active")) {
          return fail("Выберите активного диспетчера");
        }
        setState(
          withAudit(
            {
              ...current,
              conversations: current.conversations.map((item) =>
                item.id === conversationId ? { ...item, assigneeId, updatedAt: new Date().toISOString() } : item,
              ),
            },
            actor.id,
            "Назначен ответственный",
            target ? fullName(target) : "Снят ответственный",
            "conversation",
            conversationId,
          ),
        );
        return ok();
      },
      setRequestStatus(conversationId, status) {
        const current = requireState();
        if (!actor || viewing) return fail("Недостаточно прав");
        const conversation = current.conversations.find((item) => item.id === conversationId);
        if (!conversation) return fail("Обращение не найдено");
        const allowed = actor.role === "admin" || conversation.assigneeId === actor.id;
        if (!allowed) return fail("Менять статус может ответственный или администратор");
        setState({
          ...current,
          conversations: current.conversations.map((item) =>
            item.id === conversationId ? { ...item, status, updatedAt: new Date().toISOString() } : item,
          ),
        });
        return ok();
      },
      setSource(conversationId, source, reason) {
        const current = requireState();
        if (!actor || viewing) return fail("Недостаточно прав");
        const conversation = current.conversations.find((item) => item.id === conversationId);
        if (!conversation) return fail("Обращение не найдено");
        const allowed = actor.role === "admin" || conversation.assigneeId === actor.id;
        if (!allowed) return fail("Недостаточно прав");
        const cleanReason = reason.trim();
        if (cleanReason.length < 3) return fail("Укажите, почему меняется источник");
        if (conversation.source === source) return fail("Этот источник уже указан");
        const customer = current.customers.find((item) => item.id === conversation.customerId);
        setState(
          withAudit(
            {
              ...current,
              conversations: current.conversations.map((item) =>
                item.id === conversationId ? { ...item, source, updatedAt: new Date().toISOString() } : item,
              ),
              sourceChanges: [
                {
                  id: uid(),
                  conversationId,
                  from: conversation.source,
                  to: source,
                  actorId: actor.id,
                  reason: cleanReason,
                  at: new Date().toISOString(),
                },
                ...current.sourceChanges,
              ],
            },
            actor.id,
            "Источник изменён",
            `${customer?.name ?? "Клиент"}: ${SOURCE_LABEL[conversation.source]} → ${SOURCE_LABEL[source]}. ${cleanReason}`,
            "conversation",
            conversationId,
          ),
        );
        return ok();
      },
      addNote(conversationId, text) {
        const current = requireState();
        if (!actor || viewing) return fail("В режиме просмотра заметки недоступны");
        const conversation = current.conversations.find((item) => item.id === conversationId);
        if (!conversation) return fail("Обращение не найдено");
        const allowed =
          actor.role === "admin" || conversation.assigneeId === actor.id || conversation.assigneeId === null;
        if (!allowed) return fail("Недостаточно прав");
        const body = text.trim();
        if (body.length < 2) return fail("Заметка слишком короткая");
        setState({
          ...current,
          notes: [
            { id: uid(), conversationId, authorId: actor.id, text: body, at: new Date().toISOString() },
            ...current.notes,
          ],
        });
        return ok();
      },
      markRead(conversationId) {
        const current = requireState();
        const conversation = current.conversations.find((item) => item.id === conversationId);
        if (!conversation || conversation.unread === 0) return;
        if (actor?.role === "dispatcher" && conversation.assigneeId && conversation.assigneeId !== actor.id) return;
        setState({
          ...current,
          conversations: current.conversations.map((item) =>
            item.id === conversationId ? { ...item, unread: 0 } : item,
          ),
        });
      },
      resetDemo() {
        const current = requireState();
        if (!actor || actor.role !== "admin" || viewing) return;
        const fresh = createSeed();
        fresh.session = { userId: actor.id, viewAsUserId: null };
        setState(
          withAudit(fresh, actor.id, "Сброс локальных данных", "Демонстрационные данные восстановлены", "settings", "demo"),
        );
      },
    };
  }, [actorId(state), now, ready, state]);

  return <CrmContext.Provider value={api}>{children}</CrmContext.Provider>;
}

function actorId(state: CrmState | null) {
  return state?.session?.userId ?? "";
}

export function useCrm() {
  const value = useContext(CrmContext);
  if (!value) throw new Error("CRM store is unavailable");
  return value;
}
