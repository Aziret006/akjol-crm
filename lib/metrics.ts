import { fullName, SOURCE_LABEL } from "./labels";
import type { Conversation, CrmState, Message, SourceKind, User } from "./types";
import { addDays, bishkekDateString, datesBetween, formatDuration, inDateRange, periodBounds } from "./time";
import { currentStatus, openShift, summarizeDate } from "./attendance";
import type { PeriodKind } from "./types";

export function visibleConversations(state: CrmState, user: User | null, asDispatcher: boolean) {
  if (!user) return [];
  if (!asDispatcher) return state.conversations;
  return state.conversations.filter(
    (conversation) => conversation.assigneeId === user.id || conversation.assigneeId === null,
  );
}

export function lastMessage(messages: Message[], conversationId: string) {
  return messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1);
}

export function firstResponseMs(messages: Message[], conversationId: string) {
  const list = messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.at.localeCompare(b.at));
  const firstIn = list.find((message) => message.direction === "in");
  if (!firstIn) return null;
  const firstOut = list.find((message) => message.direction === "out" && message.at >= firstIn.at);
  if (!firstOut) return null;
  return new Date(firstOut.at).getTime() - new Date(firstIn.at).getTime();
}

export function hasReply(messages: Message[], conversationId: string) {
  return messages.some((message) => message.conversationId === conversationId && message.direction === "out");
}

export function sourceStats(state: CrmState, from: string, to: string) {
  const rows = state.conversations.filter((conversation) => inDateRange(conversation.createdAt, from, to));
  const total = rows.length;
  const kinds = Object.keys(SOURCE_LABEL) as SourceKind[];
  return kinds
    .map((source) => {
      const items = rows.filter((conversation) => conversation.source === source);
      const processed = items.filter((conversation) => conversation.status === "done").length;
      const unanswered = items.filter((conversation) => !hasReply(state.messages, conversation.id)).length;
      return {
        source,
        label: SOURCE_LABEL[source],
        count: items.length,
        share: total ? Math.round((items.length / total) * 1000) / 10 : 0,
        processed,
        unanswered,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function dispatcherReport(state: CrmState, period: PeriodKind, now = Date.now()) {
  const bounds = periodBounds(period, new Date(now));
  const dispatchers = state.users.filter((user) => user.role === "dispatcher");
  return dispatchers.map((user) => {
    const assigned = state.conversations.filter(
      (conversation) =>
        conversation.assigneeId === user.id && inDateRange(conversation.updatedAt, bounds.from, bounds.to),
    );
    const handled = assigned.filter((conversation) => conversation.status === "done");
    const open = assigned.filter((conversation) => conversation.status !== "done");
    const inbound = state.messages.filter(
      (message) =>
        message.direction === "in" &&
        inDateRange(message.at, bounds.from, bounds.to) &&
        assigned.some((conversation) => conversation.id === message.conversationId),
    );
    const responses = assigned
      .map((conversation) => firstResponseMs(state.messages, conversation.id))
      .filter((value): value is number => value != null);
    const avg = responses.length ? responses.reduce((sum, value) => sum + value, 0) / responses.length : null;
    const dates = datesBetween(bounds.from, bounds.to);
    const worked = dates.reduce(
      (sum, date) => sum + summarizeDate(state.events, user.id, date, now, user.scheduleStart).workedMs,
      0,
    );
    return {
      user,
      name: fullName(user),
      handled: handled.length,
      open: open.length,
      inbound: inbound.length,
      avgFirstResponse: avg,
      workedMs: worked,
      workedLabel: formatDuration(worked),
    };
  });
}

export function dashboardStats(state: CrmState, now = Date.now()) {
  const today = bishkekDateString(new Date(now));
  const people = state.users.map((user) => ({
    user,
    summary: summarizeDate(state.events, user.id, today, now, user.scheduleStart),
  }));
  const activePeople = people.filter((item) => item.user.accountStatus === "active");
  const todayConversations = state.conversations.filter((conversation) =>
    inDateRange(conversation.createdAt, today, today),
  );
  const todayMessages = state.messages.filter((message) => inDateRange(message.at, today, today));
  const responseValues = todayConversations
    .map((conversation) => firstResponseMs(state.messages, conversation.id))
    .filter((value): value is number => value != null);

  return {
    employees: state.users.length,
    working: activePeople.filter((item) => item.summary.status === "working").length,
    away: activePeople.filter((item) => item.summary.status === "away").length,
    finished: activePeople.filter((item) => item.summary.status === "finished").length,
    incoming: todayConversations.length,
    messages: todayMessages.length,
    avgResponse: responseValues.length
      ? responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length
      : null,
    connections: 0,
    people,
    sources: sourceStats(state, today, today),
  };
}

export function handledToday(state: CrmState, userId: string, now = Date.now()) {
  const today = bishkekDateString(new Date(now));
  return state.conversations.filter(
    (conversation) =>
      conversation.assigneeId === userId &&
      conversation.status === "done" &&
      inDateRange(conversation.updatedAt, today, today),
  ).length;
}

export type OverviewRange = "today" | "yesterday" | "7" | "30";

export function overviewBounds(range: OverviewRange, now = Date.now()) {
  const today = bishkekDateString(new Date(now));
  if (range === "today") return { from: today, to: today, label: "Сегодня" };
  if (range === "yesterday") {
    const day = addDays(today, -1);
    return { from: day, to: day, label: "Вчера" };
  }
  if (range === "7") return { from: addDays(today, -6), to: today, label: "7 дней" };
  return { from: addDays(today, -29), to: today, label: "30 дней" };
}

export function appealOverview(state: CrmState, from: string, to: string) {
  const rows = state.conversations.filter((conversation) => inDateRange(conversation.createdAt, from, to));
  const responses = rows
    .map((conversation) => firstResponseMs(state.messages, conversation.id))
    .filter((value): value is number => value != null);
  const days = datesBetween(from, to).map((day) => ({
    day,
    count: rows.filter((conversation) => bishkekDateString(new Date(conversation.createdAt)) === day).length,
  }));
  const maxDay = Math.max(1, ...days.map((day) => day.count));
  const sources = sourceStats(state, from, to);
  const maxSource = Math.max(1, ...sources.map((source) => source.count));
  const dispatchers = state.users
    .filter((user) => user.role === "dispatcher")
    .map((user) => {
      const assigned = rows.filter((conversation) => conversation.assigneeId === user.id);
      const done = assigned.filter((conversation) => conversation.status === "done").length;
      return { user, assigned: assigned.length, done };
    })
    .sort((a, b) => b.done - a.done || b.assigned - a.assigned);
  return {
    total: rows.length,
    done: rows.filter((conversation) => conversation.status === "done").length,
    open: rows.filter((conversation) => conversation.status !== "done").length,
    unassigned: rows.filter((conversation) => !conversation.assigneeId && conversation.status !== "done").length,
    avgResponse: responses.length ? responses.reduce((sum, value) => sum + value, 0) / responses.length : null,
    days,
    maxDay,
    sources,
    maxSource,
    dispatchers,
    recent: [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
  };
}

export function shiftSnapshot(state: CrmState, now = Date.now()) {
  const today = bishkekDateString(new Date(now));
  const dispatchers = state.users.filter((user) => user.role === "dispatcher" && user.accountStatus === "active");
  let onShift = 0;
  const stale: { user: User; startedAt: string; status: "working" | "away" }[] = [];
  for (const user of dispatchers) {
    const todayEvents = summarizeDate(state.events, user.id, today, now, user.scheduleStart).events;
    const status = currentStatus(state.events, user.id, new Date(now));
    if (todayEvents.length > 0 && (status === "working" || status === "away")) onShift += 1;
    const open = openShift(state.events, user.id);
    if (!open) continue;
    const startedAt = open.events[0].at;
    if (bishkekDateString(new Date(startedAt)) < today && (status === "working" || status === "away")) {
      stale.push({ user, startedAt, status });
    }
  }
  return { onShift, stale };
}

export function waitingAppeals(state: CrmState, now = Date.now()) {
  const limit = now - 2 * 60 * 60 * 1000;
  return state.conversations.filter((conversation) => {
    if (conversation.status === "done") return false;
    if (new Date(conversation.createdAt).getTime() > limit) return false;
    return !hasReply(state.messages, conversation.id);
  });
}

export function customerConversations(state: CrmState, customerId: string, exceptId?: string): Conversation[] {
  return state.conversations
    .filter((conversation) => conversation.customerId === customerId && conversation.id !== exceptId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
