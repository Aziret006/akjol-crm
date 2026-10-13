import { fullName, SOURCE_LABEL } from "./labels";
import type { Conversation, CrmState, Message, SourceKind, User } from "./types";
import { bishkekDateString, datesBetween, formatDuration, inDateRange, periodBounds } from "./time";
import { summarizeDate } from "./attendance";
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

export function customerConversations(state: CrmState, customerId: string, exceptId?: string): Conversation[] {
  return state.conversations
    .filter((conversation) => conversation.customerId === customerId && conversation.id !== exceptId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
