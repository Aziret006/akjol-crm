"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { allows, type Permission } from "./access";
import { currentStatus, nextEventType, openShift } from "./attendance";
import { demoDrivers } from "./drivers";
import { canEditDriver, normalizeDriver } from "./recruitment";
import { fullName, ORDER_HOLD_LABEL, ORDER_SOURCE_LABEL, ORDER_STATUS_LABEL, SOURCE_LABEL } from "./labels";
import { canAssignDriver, canSeeOrder, findCustomerByPhone, nextOrderNumber, normalizeOrder, phoneDigits, similarOpenOrder, STATUS_TRANSITIONS } from "./orders";
import { createSeed } from "./seed";
import { formatDateTime, isoAt, sha256 } from "./time";
import type {
  AccountStatus,
  ActionResult,
  AttendanceType,
  CrmState,
  DocKind,
  DocStatus,
  DriverAvailability,
  LeadSource,
  Order,
  OrderEvent,
  OrderHold,
  OrderPriority,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  RecruitStage,
  RequestStatus,
  Role,
  StopReason,
  SourceKind,
  User,
} from "./types";

const STORAGE_KEY = "akjol-crm-frontend-v1";
let keepStoredState = false;

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
  drivers: [],
  driverTasks: [],
  driverNotes: [],
  ratings: [],
  orders: [],
  orderEvents: [],
  session: null,
};

export type OrderInput = {
  phone: string;
  name: string;
  pickup: string;
  dropoff: string;
  pickupAt: string | null;
  comment: string;
  passengers: number | null;
  payment: PaymentMethod | null;
  price: number | null;
  source: OrderSource;
  driverId: string | null;
  vehicleNote: string;
  conversationId: string | null;
  callId: string | null;
  idempotencyKey: string;
  confirmDuplicate: boolean;
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
  createOrder: (input: OrderInput) => ActionResult;
  setOrderStatus: (orderId: string, status: OrderStatus, reason?: string) => ActionResult;
  assignOrderDriver: (orderId: string, driverId: string | null) => ActionResult;
  setOrderAttention: (orderId: string, hold: OrderHold | null, callbackAt: string | null, priority: OrderPriority) => ActionResult;
  reopenOrder: (orderId: string, reason: string) => ActionResult;
  reassignOrderDispatcher: (orderId: string, dispatcherId: string) => ActionResult;
  setDriverAvailability: (driverId: string, availability: DriverAvailability) => ActionResult;
  saveLead: (input: { firstName: string; lastName: string; phone: string; source: LeadSource; city: string }) => ActionResult;
  setRecruitStage: (driverId: string, stage: RecruitStage, reason?: StopReason | null, note?: string) => ActionResult;
  saveDriverProfile: (driverId: string, patch: Partial<Pick<import("./types").Driver, "firstName" | "lastName" | "phone" | "city" | "address" | "citizenship" | "inn" | "licenseNumber" | "plate" | "carModel" | "carColor" | "carYear" | "carCategory" | "pitchNoted" | "note">>) => ActionResult;
  setDriverDoc: (driverId: string, kind: DocKind, status: DocStatus) => ActionResult;
  addDriverNote: (driverId: string, text: string) => ActionResult;
  addDriverTask: (driverId: string, title: string, dueAt: string, priority: "normal" | "high") => ActionResult;
  completeDriverTask: (taskId: string) => ActionResult;
  deleteDriver: (driverId: string, reason: string) => ActionResult;
  recordRating: (driverId: string, dispatcherId: string, score: number) => ActionResult;
  resetDemo: () => void;
};

const CrmContext = createContext<CrmApi | null>(null);

function ok(): ActionResult {
  return { ok: true };
}

function fail(error: string, code?: "confirm-finish" | "duplicate-order"): ActionResult {
  return { ok: false, error, code };
}

function deny(actor: User | null, viewing: boolean, permission: Permission) {
  if (!actor || viewing || !allows(actor.role, permission)) return "Недостаточно прав";
  return null;
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
    return {
      ...parsed,
      drivers: (Array.isArray(parsed.drivers) ? parsed.drivers : demoDrivers()).map((driver) => normalizeDriver(driver)),
      driverTasks: Array.isArray(parsed.driverTasks) ? parsed.driverTasks : [],
      driverNotes: Array.isArray(parsed.driverNotes) ? parsed.driverNotes : [],
      ratings: Array.isArray(parsed.ratings) ? parsed.ratings : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders.map((order) => normalizeOrder(order)) : [],
      orderEvents: Array.isArray(parsed.orderEvents) ? parsed.orderEvents : [],
    };
  } catch {
    keepStoredState = true;
    return createSeed();
  }
}

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CrmState>(EMPTY_STATE);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const stateRef = useRef<CrmState>(EMPTY_STATE);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    try {
      setState(loadState());
      setNow(Date.now());
    } finally {
      setReady(true);
    }
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (keepStoredState) {
      keepStoredState = false;
      return;
    }
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
      createOrder(input) {
        const current = requireState();
        const denied = deny(actor, viewing, "orders.create");
        if (denied || !actor) return fail(denied ?? "Недостаточно прав");
        const key = input.idempotencyKey.trim();
        if (!key) return fail("Не удалось сохранить заказ. Откройте форму ещё раз.");
        const existingKey = current.orders.find((order) => order.idempotencyKey === key);
        if (existingKey) return { ok: true, orderId: existingKey.id };
        const phone = input.phone.trim();
        const pickup = input.pickup.trim();
        if (phone.replace(/\D/g, "").length < 6) return fail("Укажите телефон клиента");
        if (pickup.length < 3) return fail("Укажите адрес подачи");
        if (input.passengers != null && (!Number.isInteger(input.passengers) || input.passengers < 1 || input.passengers > 8)) {
          return fail("Количество пассажиров: от 1 до 8");
        }
        if (input.price != null && (!Number.isFinite(input.price) || input.price < 0)) return fail("Стоимость указана неверно");
        const driver = input.driverId ? current.drivers.find((item) => item.id === input.driverId) ?? null : null;
        if (input.driverId && !driver) return fail("Водитель не найден");
        if (driver && !canAssignDriver(current.orders, driver, "")) return fail("Этот водитель занят или не на линии");
        if (!input.confirmDuplicate) {
          const similar = similarOpenOrder(current.orders, current.customers, phone, pickup);
          if (similar) {
            return fail(`Похожий заказ №${similar.number} уже открыт`, "duplicate-order");
          }
        }
        const matched = findCustomerByPhone(current.customers, phone);
        const customer = matched ?? {
          id: uid(),
          name: input.name.trim() || "Клиент",
          phone,
          city: "Бишкек",
        };
        const nowIso = new Date().toISOString();
        const orderId = uid();
        const status: OrderStatus = driver ? "assigned" : "awaiting_driver";
        const order: Order = {
          id: orderId,
          number: nextOrderNumber(current.orders),
          customerId: customer.id,
          pickup,
          dropoff: input.dropoff.trim(),
          pickupAt: input.pickupAt,
          comment: input.comment.trim(),
          passengers: input.passengers,
          payment: input.payment,
          price: input.price,
          source: input.source,
          status,
          driverId: driver?.id ?? null,
          dispatcherId: actor.id,
          conversationId: input.conversationId,
          cancelReason: "",
          callId: input.callId,
          priority: "normal",
          hold: null,
          callbackAt: null,
          vehicleNote: input.vehicleNote.trim(),
          idempotencyKey: key,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const events: OrderEvent[] = [
          {
            id: uid(),
            orderId,
            actorId: actor.id,
            kind: "created",
            detail: `Заказ создан. Источник: ${ORDER_SOURCE_LABEL[input.source]}`,
            at: nowIso,
          },
        ];
        if (driver) {
          events.push({
            id: uid(),
            orderId,
            actorId: actor.id,
            kind: "assigned",
            detail: `Назначен водитель ${fullName(driver)}`,
            at: nowIso,
          });
        }
        setState(
          withAudit(
            {
              ...current,
              customers: matched ? current.customers : [customer, ...current.customers],
              orders: [order, ...current.orders],
              orderEvents: [...events.reverse(), ...current.orderEvents],
            },
            actor.id,
            "Заказ создан",
            `№${order.number}, ${customer.name}, ${ORDER_SOURCE_LABEL[input.source]}`,
            "order",
            orderId,
          ),
        );
        return { ok: true, orderId };
      },
      setOrderStatus(orderId, status, reason = "") {
        const current = requireState();
        const permission: Permission = status === "cancelled" ? "orders.cancel" : "orders.edit";
        const denied = deny(actor, viewing, permission);
        if (denied || !actor) return fail(denied ?? "Недостаточно прав");
        const order = current.orders.find((item) => item.id === orderId);
        if (!order) return fail("Заказ не найден");
        if (!canSeeOrder(order, actor.id, allows(actor.role, "orders.view_all"))) return fail("Этот заказ вам не назначен");
        if (!STATUS_TRANSITIONS[order.status].includes(status)) return fail("Такой переход статуса недоступен");
        const cleanReason = reason.trim();
        if (status === "cancelled" && cleanReason.length < 3) return fail("Укажите причину отмены");
        const nowIso = new Date().toISOString();
        setState(
          withAudit(
            {
              ...current,
              orders: current.orders.map((item) =>
                item.id === orderId
                  ? {
                      ...item,
                      status,
                      hold: null,
                      callbackAt: null,
                      cancelReason: status === "cancelled" ? cleanReason : item.cancelReason,
                      updatedAt: nowIso,
                    }
                  : item,
              ),
              orderEvents: [
                {
                  id: uid(),
                  orderId,
                  actorId: actor.id,
                  kind: status === "cancelled" ? "cancelled" : "status",
                  detail:
                    status === "cancelled"
                      ? `Отменён: ${cleanReason}`
                      : `${ORDER_STATUS_LABEL[order.status]} → ${ORDER_STATUS_LABEL[status]}`,
                  at: nowIso,
                },
                ...current.orderEvents,
              ],
            },
            actor.id,
            status === "cancelled" ? "Заказ отменён" : "Статус заказа изменён",
            `№${order.number}: ${ORDER_STATUS_LABEL[status]}`,
            "order",
            orderId,
          ),
        );
        return ok();
      },
      assignOrderDriver(orderId, driverId) {
        const current = requireState();
        const denied = deny(actor, viewing, "orders.assign_driver");
        if (denied || !actor) return fail(denied ?? "Недостаточно прав");
        const order = current.orders.find((item) => item.id === orderId);
        if (!order) return fail("Заказ не найден");
        if (!canSeeOrder(order, actor.id, allows(actor.role, "orders.view_all"))) return fail("Этот заказ вам не назначен");
        if (order.status === "done" || order.status === "cancelled") return fail("Заказ уже закрыт");
        if ((order.status === "in_progress" || order.status === "en_route") && !driverId) return fail("Сначала завершите или отмените поездку");
        if (driverId === order.driverId) return fail("Этот водитель уже назначен");
        const nextDriver = driverId ? current.drivers.find((item) => item.id === driverId) ?? null : null;
        if (driverId && !nextDriver) return fail("Водитель не найден");
        if (nextDriver && !canAssignDriver(current.orders, nextDriver, orderId)) return fail("У водителя уже есть активная поездка или он не на линии");
        const previous = order.driverId ? current.drivers.find((item) => item.id === order.driverId) : null;
        const nowIso = new Date().toISOString();
        const nextStatus: OrderStatus = nextDriver
          ? order.status === "in_progress" || order.status === "en_route"
            ? order.status
            : "assigned"
          : "awaiting_driver";
        const detail = nextDriver
          ? previous
            ? `Переназначен: ${fullName(previous)} → ${fullName(nextDriver)}`
            : `Назначен водитель ${fullName(nextDriver)}`
          : `Водитель снят${previous ? `: ${fullName(previous)}` : ""}`;
        setState(
          withAudit(
            {
              ...current,
              orders: current.orders.map((item) =>
                item.id === orderId
                  ? { ...item, driverId, status: nextStatus, hold: nextDriver && item.hold === "no_driver" ? null : item.hold, updatedAt: nowIso }
                  : item,
              ),
              orderEvents: [
                { id: uid(), orderId, actorId: actor.id, kind: "assigned", detail, at: nowIso },
                ...current.orderEvents,
              ],
            },
            actor.id,
            nextDriver ? "Водитель назначен" : "Водитель снят",
            `№${order.number}. ${detail}`,
            "order",
            orderId,
          ),
        );
        return ok();
      },
      setOrderAttention(orderId, hold, callbackAt, priority) {
        const current = requireState();
        const denied = deny(actor, viewing, "orders.edit");
        if (denied || !actor) return fail(denied ?? "Недостаточно прав");
        const order = current.orders.find((item) => item.id === orderId);
        if (!order) return fail("Заказ не найден");
        if (!canSeeOrder(order, actor.id, allows(actor.role, "orders.view_all"))) return fail("Этот заказ вам не назначен");
        if (order.status === "done" || order.status === "cancelled") return fail("Заказ уже закрыт");
        if (hold === "callback" && !callbackAt) return fail("Укажите время повторного звонка");
        if (callbackAt && Number.isNaN(new Date(callbackAt).getTime())) return fail("Время повторного звонка указано неверно");
        const nowIso = new Date().toISOString();
        const detail = hold
          ? `${ORDER_HOLD_LABEL[hold]}${hold === "callback" && callbackAt ? ` на ${formatDateTime(callbackAt)}` : ""}`
          : priority === "high" ? "Приоритет: срочный" : "Метка снята";
        setState(
          withAudit(
            {
              ...current,
              orders: current.orders.map((item) =>
                item.id === orderId ? { ...item, hold, callbackAt: hold === "callback" ? callbackAt : null, priority, updatedAt: nowIso } : item,
              ),
              orderEvents: [{ id: uid(), orderId, actorId: actor.id, kind: "hold", detail, at: nowIso }, ...current.orderEvents],
            },
            actor.id,
            "Отметка заказа",
            `№${order.number}: ${detail}`,
            "order",
            orderId,
          ),
        );
        return ok();
      },
      reopenOrder(orderId, reason) {
        const current = requireState();
        const denied = deny(actor, viewing, "orders.reopen");
        if (denied || !actor) return fail(denied ?? "Недостаточно прав");
        const order = current.orders.find((item) => item.id === orderId);
        if (!order) return fail("Заказ не найден");
        if (order.status !== "done" && order.status !== "cancelled") return fail("Открыть можно только завершённый или отменённый заказ");
        const cleanReason = reason.trim();
        if (cleanReason.length < 3) return fail("Укажите причину открытия");
        const nowIso = new Date().toISOString();
        setState(
          withAudit(
            {
              ...current,
              orders: current.orders.map((item) =>
                item.id === orderId
                  ? { ...item, status: "processing", driverId: null, hold: null, callbackAt: null, updatedAt: nowIso }
                  : item,
              ),
              orderEvents: [
                {
                  id: uid(),
                  orderId,
                  actorId: actor.id,
                  kind: "reopened",
                  detail: `Открыт снова из «${ORDER_STATUS_LABEL[order.status]}»: ${cleanReason}`,
                  at: nowIso,
                },
                ...current.orderEvents,
              ],
            },
            actor.id,
            "Заказ открыт снова",
            `№${order.number}: ${cleanReason}`,
            "order",
            orderId,
          ),
        );
        return ok();
      },
      reassignOrderDispatcher(orderId, dispatcherId) {
        const current = requireState();
        const denied = deny(actor, viewing, "orders.reassign_dispatcher");
        if (denied || !actor) return fail(denied ?? "Недостаточно прав");
        const order = current.orders.find((item) => item.id === orderId);
        if (!order) return fail("Заказ не найден");
        if (order.status === "done" || order.status === "cancelled") return fail("Заказ уже закрыт");
        const target = current.users.find((item) => item.id === dispatcherId && item.role === "dispatcher" && item.accountStatus === "active");
        if (!target) return fail("Выберите активного диспетчера");
        if (target.id === order.dispatcherId) return fail("Этот диспетчер уже назначен");
        const previous = current.users.find((item) => item.id === order.dispatcherId);
        const nowIso = new Date().toISOString();
        const detail = `${previous ? fullName(previous) : "Без диспетчера"} → ${fullName(target)}`;
        setState(
          withAudit(
            {
              ...current,
              orders: current.orders.map((item) => (item.id === orderId ? { ...item, dispatcherId, updatedAt: nowIso } : item)),
              orderEvents: [{ id: uid(), orderId, actorId: actor.id, kind: "dispatcher", detail, at: nowIso }, ...current.orderEvents],
            },
            actor.id,
            "Диспетчер переназначен",
            `№${order.number}: ${detail}`,
            "order",
            orderId,
          ),
        );
        return ok();
      },
      setDriverAvailability(driverId, availability) {
        const current = requireState();
        if (!actor || viewing || (actor.role !== "admin" && actor.role !== "dispatcher")) return fail("Недостаточно прав");
        const driver = current.drivers.find((item) => item.id === driverId);
        if (!driver) return fail("Водитель не найден");
        if (driver.availability === availability) return ok();
        if (availability === "offline" && !canAssignDriver(current.orders, { ...driver, availability: "available" }, "")) {
          return fail("У водителя активный заказ");
        }
        setState(
          withAudit(
            {
              ...current,
              drivers: current.drivers.map((item) => (item.id === driverId ? { ...item, availability } : item)),
            },
            actor.id,
            "Статус водителя изменён",
            `${fullName(driver)}: ${availability === "available" ? "на линии" : "не на линии"}`,
            "driver",
            driverId,
          ),
        );
        return ok();
      },
      saveLead(input) {
        const current = requireState();
        const denied = deny(actor, viewing, "drivers.edit");
        if (denied || !actor || !user) return fail(denied ?? "Недостаточно прав");
        const phone = input.phone.trim();
        const firstName = input.firstName.trim();
        const lastName = input.lastName.trim();
        if (phoneDigits(phone).length < 9) return fail("Укажите телефон");
        if (firstName.length < 2) return fail("Укажите имя");
        const duplicate = current.drivers.find((item) => phoneDigits(item.phone) === phoneDigits(phone));
        if (duplicate) return fail(`Такой телефон уже есть: ${fullName(duplicate)}`);
        const nowIso = new Date().toISOString();
        const driver = normalizeDriver({
          id: uid(),
          firstName,
          lastName,
          phone,
          availability: "offline",
          vehicle: null,
          note: "",
          createdAt: nowIso,
          city: input.city.trim() || "Бишкек",
          address: "",
          citizenship: "",
          inn: "",
          licenseNumber: "",
          plate: "",
          carModel: "",
          carColor: "",
          carYear: null,
          carCategory: "",
          docs: { passport: "missing", license: "missing", sts: "missing", insurance: "missing", inspection: "missing" },
          stage: "application",
          stopReason: null,
          stopNote: "",
          source: input.source,
          ownerId: actor.role === "dispatcher" ? actor.id : null,
          stageLog: [{ stage: "application", at: nowIso, actorId: actor.id }],
          pitchNoted: false,
          demo: false,
        });
        setState(withAudit({ ...current, drivers: [driver, ...current.drivers] }, actor.id, "Заявка водителя", `${fullName(driver)} · ${phone}`, "driver", driver.id));
        return { ok: true, orderId: driver.id };
      },
      setRecruitStage(driverId, stage, reason, note) {
        const current = requireState();
        if (!actor || !user || viewing) return fail("Недостаточно прав");
        const driver = current.drivers.find((item) => item.id === driverId);
        if (!driver) return fail("Водитель не найден");
        if (!canEditDriver(driver, user.id, allows(actor.role, "drivers.view_all"))) return fail("Эта заявка закреплена за другим диспетчером");
        if (stage === "stopped" && !reason) return fail("Укажите причину остановки");
        if (stage === driver.stage && stage !== "stopped") return ok();
        const nowIso = new Date().toISOString();
        const ownerId = driver.ownerId || (actor.role === "dispatcher" ? actor.id : driver.ownerId);
        const next = normalizeDriver({
          ...driver,
          stage,
          ownerId,
          stopReason: stage === "stopped" ? reason ?? null : null,
          stopNote: stage === "stopped" ? (note ?? "").trim() : "",
          availability: stage === "first_order" ? "available" : driver.availability,
          stageLog: [...driver.stageLog, { stage, at: nowIso, actorId: actor.id }],
        });
        setState(withAudit({ ...current, drivers: current.drivers.map((item) => (item.id === driverId ? next : item)) }, actor.id, "Этап водителя", `${fullName(driver)} → ${stage}`, "driver", driverId));
        return ok();
      },
      saveDriverProfile(driverId, patch) {
        const current = requireState();
        if (!actor || !user || viewing) return fail("Недостаточно прав");
        const driver = current.drivers.find((item) => item.id === driverId);
        if (!driver) return fail("Водитель не найден");
        if (!canEditDriver(driver, user.id, allows(actor.role, "drivers.view_all"))) return fail("Недостаточно прав");
        const phone = patch.phone?.trim() ?? driver.phone;
        if (phoneDigits(phone).length < 9) return fail("Укажите телефон");
        const clash = current.drivers.find((item) => item.id !== driver.id && phoneDigits(item.phone) === phoneDigits(phone));
        if (clash) return fail("Телефон уже занят другой карточкой");
        const next = normalizeDriver({
          ...driver,
          ...patch,
          phone,
          firstName: patch.firstName?.trim() || driver.firstName,
          lastName: patch.lastName?.trim() ?? driver.lastName,
          demo: driver.demo,
        });
        setState(withAudit({ ...current, drivers: current.drivers.map((item) => (item.id === driverId ? next : item)) }, actor.id, "Карточка водителя", fullName(next), "driver", driverId));
        return ok();
      },
      setDriverDoc(driverId, kind, status) {
        const current = requireState();
        if (!actor || !user || viewing) return fail("Недостаточно прав");
        const driver = current.drivers.find((item) => item.id === driverId);
        if (!driver) return fail("Водитель не найден");
        if (!canEditDriver(driver, user.id, allows(actor.role, "drivers.view_all"))) return fail("Недостаточно прав");
        const next = normalizeDriver({ ...driver, docs: { ...driver.docs, [kind]: status } });
        setState(withAudit({ ...current, drivers: current.drivers.map((item) => (item.id === driverId ? next : item)) }, actor.id, "Документ водителя", `${fullName(driver)} · ${kind}`, "driver", driverId));
        return ok();
      },
      addDriverNote(driverId, text) {
        const current = requireState();
        if (!actor || !user || viewing) return fail("Недостаточно прав");
        const driver = current.drivers.find((item) => item.id === driverId);
        if (!driver) return fail("Водитель не найден");
        if (!canEditDriver(driver, user.id, allows(actor.role, "drivers.view_all"))) return fail("Недостаточно прав");
        const clean = text.trim();
        if (clean.length < 2) return fail("Введите заметку");
        setState(withAudit({
          ...current,
          driverNotes: [{ id: uid(), driverId, authorId: actor.id, text: clean, at: new Date().toISOString() }, ...current.driverNotes],
        }, actor.id, "Заметка по водителю", fullName(driver), "driver", driverId));
        return ok();
      },
      addDriverTask(driverId, title, dueAt, priority) {
        const current = requireState();
        if (!actor || !user || viewing) return fail("Недостаточно прав");
        const driver = current.drivers.find((item) => item.id === driverId);
        if (!driver) return fail("Водитель не найден");
        if (!canEditDriver(driver, user.id, allows(actor.role, "drivers.view_all"))) return fail("Недостаточно прав");
        const clean = title.trim();
        if (clean.length < 3) return fail("Опишите задачу");
        if (!dueAt) return fail("Укажите срок");
        const assigneeId = driver.ownerId || actor.id;
        setState({
          ...current,
          driverTasks: [{ id: uid(), driverId, assigneeId, title: clean, dueAt, doneAt: null, priority, createdAt: new Date().toISOString() }, ...current.driverTasks],
        });
        return ok();
      },
      completeDriverTask(taskId) {
        const current = requireState();
        if (!actor || viewing) return fail("Недостаточно прав");
        const task = current.driverTasks.find((item) => item.id === taskId);
        if (!task) return fail("Задача не найдена");
        if (actor.role !== "admin" && task.assigneeId !== actor.id) return fail("Это задача другого диспетчера");
        setState({
          ...current,
          driverTasks: current.driverTasks.map((item) => (item.id === taskId ? { ...item, doneAt: new Date().toISOString() } : item)),
        });
        return ok();
      },
      deleteDriver(driverId, reason) {
        const current = requireState();
        const denied = deny(actor, viewing, "drivers.delete");
        if (denied || !actor) return fail(denied ?? "Удалять водителей может только администратор");
        const driver = current.drivers.find((item) => item.id === driverId);
        if (!driver) return fail("Водитель не найден");
        if (reason.trim().length < 3) return fail("Укажите причину");
        const active = current.orders.some((order) => order.driverId === driverId && order.status !== "done" && order.status !== "cancelled");
        if (active) return fail("У водителя есть открытый заказ. Сначала закройте его.");
        setState(withAudit({
          ...current,
          drivers: current.drivers.filter((item) => item.id !== driverId),
        }, actor.id, "Водитель удалён", `${fullName(driver)}: ${reason.trim()}`, "driver", driverId));
        return ok();
      },
      recordRating(driverId, dispatcherId, score) {
        const current = requireState();
        if (!actor || viewing || actor.role !== "admin") return fail("Оценку вручную может записать только администратор");
        if (score < 1 || score > 5) return fail("Оценка от 1 до 5");
        const driver = current.drivers.find((item) => item.id === driverId);
        const dispatcher = current.users.find((item) => item.id === dispatcherId && item.role === "dispatcher");
        if (!driver || !dispatcher) return fail("Водитель или диспетчер не найден");
        setState(withAudit({
          ...current,
          ratings: [{ id: uid(), driverId, dispatcherId, score, at: new Date().toISOString(), channel: "manual" }, ...current.ratings],
        }, actor.id, "Оценка диспетчера", `${fullName(dispatcher)} · ${score} · вручную, не из WhatsApp`, "user", dispatcherId));
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
        if (!actor || actor.role !== "admin" || viewing) return;
        const fresh = createSeed();
        fresh.session = { userId: actor.id, viewAsUserId: null };
        setState(
          withAudit(fresh, actor.id, "Сброс локальных данных", "Демонстрационные данные восстановлены", "settings", "demo"),
        );
      },
    };
  }, [now, ready, state]);

  return <CrmContext.Provider value={api}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const value = useContext(CrmContext);
  if (!value) throw new Error("CRM store is unavailable");
  return value;
}
