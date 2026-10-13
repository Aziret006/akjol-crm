import type {
  DeskStatus,
  DispatcherView,
  TelephonyCall,
  TelephonyFile,
  TelephonyPresence,
  TelephonyPublic,
  TelephonyWebhookEvent,
} from "./model";

export function emptyTelephony(): TelephonyFile {
  return { presences: [], calls: [], seen: [], errors: [], maxConcurrent: 1 };
}

export function callLoad(calls: TelephonyCall[], userId: string) {
  return calls.filter(
    (call) => call.dispatcherId === userId && (call.state === "assigned" || call.state === "answered"),
  ).length;
}

export function effectiveStatus(presence: TelephonyPresence, calls: TelephonyCall[]): DeskStatus {
  if (callLoad(calls, presence.userId) > 0) return "talking";
  return presence.status;
}

function eligible(state: TelephonyFile, presence: TelephonyPresence) {
  return (
    presence.role === "dispatcher" &&
    presence.status === "available" &&
    callLoad(state.calls, presence.userId) < state.maxConcurrent
  );
}

export function pickDispatcher(state: TelephonyFile) {
  const ready = state.presences.filter((presence) => eligible(state, presence));
  ready.sort((a, b) => {
    const load = callLoad(state.calls, a.userId) - callLoad(state.calls, b.userId);
    if (load !== 0) return load;
    const aAt = a.lastAssignedAt ?? "";
    const bAt = b.lastAssignedAt ?? "";
    if (aAt !== bAt) return aAt < bAt ? -1 : 1;
    return a.userId < b.userId ? -1 : 1;
  });
  return ready[0] ?? null;
}

function assignQueued(state: TelephonyFile, nowIso: string): TelephonyFile {
  let next = state;
  while (true) {
    const queued = next.calls
      .filter((call) => call.state === "queued")
      .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
    const call = queued[0];
    const dispatcher = call ? pickDispatcher(next) : null;
    if (!call || !dispatcher) break;
    next = {
      ...next,
      calls: next.calls.map((item) =>
        item.id === call.id
          ? { ...item, state: "assigned", dispatcherId: dispatcher.userId, assignedAt: nowIso, queueReason: null }
          : item,
      ),
      presences: next.presences.map((item) =>
        item.userId === dispatcher.userId ? { ...item, lastAssignedAt: nowIso } : item,
      ),
    };
  }
  return next;
}

function remember(state: TelephonyFile, key: string): TelephonyFile {
  return { ...state, seen: [key, ...state.seen.filter((item) => item !== key)].slice(0, 2000) };
}

function addError(state: TelephonyFile, message: string, eventId: string | null, at: string): TelephonyFile {
  return {
    ...state,
    errors: [{ id: `${at}-${eventId ?? "x"}-${state.errors.length}`, at, message, eventId }, ...state.errors].slice(0, 100),
  };
}

export function pushError(state: TelephonyFile, message: string, at: string) {
  return addError(state, message, null, at);
}

export type EventResult =
  | { ok: true; duplicate: boolean; call: TelephonyCall | null; state: TelephonyFile }
  | { ok: false; error: string; status: number; state: TelephonyFile };

export function applyEvent(state: TelephonyFile, event: TelephonyWebhookEvent, nowIso: string): EventResult {
  const eventId = event.eventId.trim();
  if (!eventId || eventId.length > 120) {
    return { ok: false, error: "Нет идентификатора события", status: 400, state };
  }
  const key = `${event.type}:${eventId}`;
  if (state.seen.includes(key)) {
    const id = event.callId || eventId;
    const call = state.calls.find((item) => item.id === id || item.eventId === eventId) ?? null;
    return { ok: true, duplicate: true, call, state };
  }
  const at = event.at && !Number.isNaN(new Date(event.at).getTime()) ? new Date(event.at).toISOString() : nowIso;

  if (event.type === "incoming") {
    const from = (event.from ?? "").trim();
    if (from.length < 3) {
      const failed = remember(addError(state, "Входящее событие без номера клиента", eventId, nowIso), key);
      return { ok: false, error: "Укажите номер клиента", status: 400, state: failed };
    }
    if (state.calls.some((call) => call.id === eventId)) {
      return { ok: true, duplicate: true, call: state.calls.find((call) => call.id === eventId) ?? null, state: remember(state, key) };
    }
    const base: TelephonyCall = {
      id: eventId,
      eventId,
      from,
      arrivedAt: at,
      assignedAt: null,
      answeredAt: null,
      endedAt: null,
      durationSec: null,
      dispatcherId: null,
      state: "queued",
      result: null,
      orderId: null,
      queueReason: "Нет свободных диспетчеров",
    };
    const withCall = remember({ ...state, calls: [base, ...state.calls] }, key);
    const assigned = assignQueued(withCall, nowIso);
    return { ok: true, duplicate: false, call: assigned.calls.find((call) => call.id === eventId) ?? null, state: assigned };
  }

  const callId = (event.callId || eventId).trim();
  const existing = state.calls.find((call) => call.id === callId);
  if (!existing) {
    if (event.type === "missed") {
      const from = (event.from ?? "").trim() || "неизвестен";
      const missed: TelephonyCall = {
        id: callId,
        eventId,
        from,
        arrivedAt: at,
        assignedAt: null,
        answeredAt: null,
        endedAt: at,
        durationSec: null,
        dispatcherId: null,
        state: "ended",
        result: "missed",
        orderId: null,
        queueReason: null,
      };
      return { ok: true, duplicate: false, call: missed, state: remember({ ...state, calls: [missed, ...state.calls] }, key) };
    }
    const failed = addError(state, "Событие звонка пришло раньше создания или с неизвестным id", eventId, nowIso);
    return { ok: false, error: "Звонок не найден", status: 404, state: failed };
  }
  if (existing.state === "ended") {
    return { ok: true, duplicate: true, call: existing, state: remember(state, key) };
  }

  if (event.type === "answered") {
    if (!existing.dispatcherId) {
      const failed = remember(addError(state, "Ответ по звонку, который никому не назначен", eventId, nowIso), key);
      return { ok: false, error: "Звонок ещё не назначен", status: 409, state: failed };
    }
    const call: TelephonyCall = { ...existing, state: "answered", answeredAt: existing.answeredAt ?? at };
    return {
      ok: true,
      duplicate: false,
      call,
      state: remember({ ...state, calls: state.calls.map((item) => (item.id === existing.id ? call : item)) }, key),
    };
  }

  const duration = typeof event.durationSec === "number" && event.durationSec >= 0 ? Math.round(event.durationSec) : existing.durationSec;
  const missed = event.type === "missed" || !existing.answeredAt;
  const call: TelephonyCall = {
    ...existing,
    state: "ended",
    endedAt: at,
    durationSec: duration,
    result: missed ? "missed" : "answered",
    queueReason: null,
  };
  const closed = remember({ ...state, calls: state.calls.map((item) => (item.id === existing.id ? call : item)) }, key);
  return { ok: true, duplicate: false, call, state: assignQueued(closed, nowIso) };
}

export function applyPresence(
  state: TelephonyFile,
  input: { userId: string; role: "admin" | "dispatcher"; status: TelephonyPresence["status"] },
  nowIso: string,
): { ok: true; state: TelephonyFile } | { ok: false; error: string; state: TelephonyFile } {
  if (!input.userId.trim()) return { ok: false, error: "Нет сотрудника", state };
  if (input.status !== "off_shift" && input.status !== "available" && input.status !== "break" && input.status !== "finished") {
    return { ok: false, error: "Статус «разговаривает» ставит только событие звонка", state };
  }
  const current = state.presences.find((item) => item.userId === input.userId);
  if ((input.status === "break" || input.status === "finished" || input.status === "off_shift") && callLoad(state.calls, input.userId) > 0) {
    return { ok: false, error: "Есть назначенный звонок. Дождитесь события завершения от телефонии.", state };
  }
  const presence: TelephonyPresence = {
    userId: input.userId,
    role: input.role,
    status: input.status,
    updatedAt: nowIso,
    lastAssignedAt: current?.lastAssignedAt ?? null,
  };
  const next: TelephonyFile = {
    ...state,
    presences: [presence, ...state.presences.filter((item) => item.userId !== input.userId)],
  };
  return { ok: true, state: input.status === "available" ? assignQueued(next, nowIso) : next };
}

export function linkOrder(state: TelephonyFile, callId: string, orderId: string): { ok: true; state: TelephonyFile } | { ok: false; error: string; state: TelephonyFile } {
  const call = state.calls.find((item) => item.id === callId);
  if (!call) return { ok: false, error: "Звонок не найден", state };
  if (call.orderId === orderId) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, calls: state.calls.map((item) => (item.id === callId ? { ...item, orderId } : item)) },
  };
}

export function setMaxConcurrent(state: TelephonyFile, value: number): TelephonyFile {
  const maxConcurrent = Math.min(5, Math.max(1, Math.round(value)));
  return { ...state, maxConcurrent };
}

export function dispatcherViews(state: TelephonyFile): DispatcherView[] {
  return state.presences.map((presence) => ({
    userId: presence.userId,
    role: presence.role,
    status: effectiveStatus(presence, state.calls),
    load: callLoad(state.calls, presence.userId),
  }));
}

export function toPublic(
  state: TelephonyFile,
  connection: { connected: boolean; provider: string | null; sharedNumber: string | null },
  viewer: { userId: string; role: "admin" | "dispatcher" },
): TelephonyPublic {
  const admin = viewer.role === "admin";
  const calls = admin ? state.calls : state.calls.filter((call) => call.dispatcherId === viewer.userId);
  const active = state.calls.filter((call) => call.state === "assigned" || call.state === "answered");
  const queueCount = state.calls.filter((call) => call.state === "queued").length;
  return {
    connected: connection.connected,
    provider: connection.provider,
    sharedNumber: connection.sharedNumber,
    browserAnswer: false,
    answerHint: connection.connected
      ? "Ответ через браузер недоступен. Ответьте на аппарате или в программе телефонии: статус придёт событием провайдера."
      : "Телефония не подключена. Входящий звонок в CRM не поступает, кнопка ответа в браузере не работает.",
    maxConcurrent: state.maxConcurrent,
    queueCount,
    queueNote: connection.connected
      ? queueCount > 0
        ? "Звонки ждут свободного диспетчера в резервной очереди CRM."
        : "В резервной очереди CRM звонков нет."
      : "Очередь АТС не запрашивается: провайдер не выбран.",
    active: admin ? active : active.filter((call) => call.dispatcherId === viewer.userId),
    dispatchers: dispatcherViews(state),
    missed: calls.filter((call) => call.result === "missed").length,
    errors: admin ? state.errors : [],
    calls,
  };
}
