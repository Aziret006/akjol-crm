"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrderForm } from "@/components/order-form";
import { CHANNEL_LABEL, SOURCE_LABEL, SOURCE_OPTIONS, STATUS_LABEL, fullName } from "@/lib/labels";
import { customerConversations, lastMessage, visibleConversations } from "@/lib/metrics";
import { orderSourceFromConversation } from "@/lib/orders";
import { useCrm } from "@/lib/store";
import { bishkekDateString, formatDateTime, formatTime } from "@/lib/time";
import type { RequestStatus, SourceKind } from "@/lib/types";
import { Button, ErrorText, Field, RequestBadge, controlClass } from "../ui";

export function ChatsScreen() {
  const crm = useCrm();
  const params = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get("chat"));
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [employee, setEmployee] = useState(params.get("employee") ?? "all");
  const [day, setDay] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [sourceReason, setSourceReason] = useState("");
  const [nextSource, setNextSource] = useState<SourceKind>("unknown");
  const [mobile, setMobile] = useState<"list" | "chat">("list");
  const [orderForm, setOrderForm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    if (!crm.user) return [];
    return visibleConversations(crm.state, crm.user, !crm.isAdmin)
      .filter((conversation) => {
        const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
        const last = lastMessage(crm.state.messages, conversation.id);
        const haystack = `${customer?.name ?? ""} ${customer?.phone ?? ""} ${last?.text ?? ""}`.toLowerCase();
        if (query && !haystack.includes(query.trim().toLowerCase())) return false;
        if (status !== "all" && conversation.status !== status) return false;
        if (source !== "all" && conversation.source !== source) return false;
        if (employee === "none" && conversation.assigneeId) return false;
        if (employee !== "all" && employee !== "none" && conversation.assigneeId !== employee) return false;
        if (day && bishkekDateString(new Date(conversation.updatedAt)) !== day) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [crm.isAdmin, crm.state, crm.user, day, employee, query, source, status]);

  const active = list.find((conversation) => conversation.id === selectedId) ?? null;
  const hidden = Boolean(
    crm.user &&
      selectedId &&
      crm.state.conversations.some((conversation) => conversation.id === selectedId) &&
      !visibleConversations(crm.state, crm.user, !crm.isAdmin).some((conversation) => conversation.id === selectedId),
  );
  const chatParam = params.get("chat");
  const employeeParam = params.get("employee");
  const queryParam = params.get("q");
  const paramKey = `${chatParam ?? ""}|${employeeParam ?? ""}|${queryParam ?? ""}`;
  const [seenParams, setSeenParams] = useState(paramKey);
  if (seenParams !== paramKey) {
    setSeenParams(paramKey);
    if (chatParam) {
      setSelectedId(chatParam);
      setMobile("chat");
    }
    if (employeeParam) setEmployee(employeeParam);
    if (queryParam) setQuery(queryParam);
  }

  useEffect(() => {
    if (active) crm.markRead(active.id);
  }, [active, crm]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [active?.id, crm.state.messages.length]);

  if (!crm.user) return null;

  const customer = active ? crm.state.customers.find((item) => item.id === active.customerId) : null;
  const messages = active
    ? crm.state.messages.filter((message) => message.conversationId === active.id).sort((a, b) => a.at.localeCompare(b.at))
    : [];
  const dispatchers = crm.state.users.filter((user) => user.role === "dispatcher" && user.accountStatus === "active");

  function choose(id: string) {
    setSelectedId(id);
    setMobile("chat");
    setError("");
  }

  function send(fileName?: string) {
    if (!active) return;
    const result = crm.sendMessage(active.id, text, fileName);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setText("");
    setError("");
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-2">
      <div className="shrink-0 rounded border border-[#d6e4f5] bg-[#f4f8fc] px-3 py-2 text-[13px]">
        Демонстрационный режим. Входящие — тестовые записи. Новые ответы сохраняются только в этом браузере и не уходят в WhatsApp.
      </div>
      <div className="grid shrink-0 gap-2 md:grid-cols-5">
        <input className={controlClass} placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className={controlClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Все статусы</option>
          {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </select>
        <select className={controlClass} value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">Все источники</option>
          {SOURCE_OPTIONS.map((item) => <option key={item} value={item}>{SOURCE_LABEL[item]}</option>)}
        </select>
        <select className={controlClass} value={employee} onChange={(event) => setEmployee(event.target.value)}>
          <option value="all">Все сотрудники</option>
          <option value="none">Без ответственного</option>
          {crm.isAdmin ? dispatchers.map((user) => <option key={user.id} value={user.id}>{fullName(user)}</option>) : null}
        </select>
        <input className={controlClass} type="date" value={day} onChange={(event) => setDay(event.target.value)} />
      </div>
      <div className="grid min-h-0 flex-1 overflow-hidden crm-panel lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className={`${mobile === "chat" ? "hidden" : "block"} min-h-0 overflow-y-auto border-[#e3e8ee] lg:block lg:border-r`}>
          {list.length === 0 ? <p className="p-4 text-sm text-[#667085]">Чатов по фильтру нет</p> : list.map((conversation) => {
            const person = crm.state.customers.find((item) => item.id === conversation.customerId);
            const last = lastMessage(crm.state.messages, conversation.id);
            const assignee = crm.state.users.find((user) => user.id === conversation.assigneeId);
            const current = conversation.id === active?.id;
            return (
              <button key={conversation.id} className={`block w-full border-b border-[#eef1f4] px-3 py-2 text-left ${current ? "bg-[#e8f2fc]" : "hover:bg-[#f7f9fb]"}`} onClick={() => choose(conversation.id)} type="button">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{person?.name}</span>
                  <span className="text-xs text-[#667085]">{last ? formatTime(last.at) : ""}</span>
                </span>
                <span className="mt-1 line-clamp-1 block text-sm text-[#667085]">{last?.text ?? "Нет сообщений"}</span>
                <span className="mt-2 flex items-center gap-2 text-xs">
                  <RequestBadge status={conversation.status} />
                  {conversation.unread > 0 ? <span className="rounded bg-[#2e6db4] text-white px-1.5 font-bold">{conversation.unread}</span> : null}
                  <span className="text-[#667085]">{assignee ? fullName(assignee) : "Не назначен"}</span>
                </span>
              </button>
            );
          })}
        </aside>
        <section className={`${mobile === "list" ? "hidden" : "flex"} min-h-0 flex-col overflow-hidden lg:flex`}>
          {!active || !customer ? <p className="p-6 text-sm text-[#667085]">Выберите чат</p> : (
            <>
              <div className="flex items-center gap-3 border-b border-[#e8eaee] px-4 py-3">
                <button className="text-sm font-semibold lg:hidden" onClick={() => setMobile("list")} type="button">Назад</button>
                <div>
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-xs text-[#667085]">{customer.phone} · {CHANNEL_LABEL[active.channel]}</p>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#f4f7f9] px-3 py-3">
                {messages.map((message) => {
                  const author = message.authorId ? crm.state.users.find((user) => user.id === message.authorId) : null;
                  const mine = message.direction === "out";
                  return (
                    <article key={message.id} className={`max-w-[80%] rounded px-2.5 py-1.5 ${mine ? "ml-auto bg-[#d9ebfb] text-[#333]" : "border border-[#e3e8ee] bg-white"}`}>
                      <p className="text-xs text-[#828b95]">{mine ? author ? fullName(author) : "Диспетчер" : customer.name} · {formatDateTime(message.at)}</p>
                      <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
                      {message.delivery === "local" ? <p className="mt-1 text-xs text-[#828b95]">Сохранено локально, в WhatsApp не отправлено</p> : null}
                      {message.delivery === "demo" ? <p className="mt-1 text-xs text-[#828b95]">Демо-запись, не из WhatsApp</p> : null}
                    </article>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form
                className="shrink-0 border-t border-[#e3e8ee] bg-white p-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <textarea className={`${controlClass} h-16 py-1.5`} placeholder={crm.readOnly ? "В режиме просмотра отправка отключена" : "Сообщение"} value={text} disabled={crm.readOnly} onChange={(event) => setText(event.target.value)} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={crm.readOnly}>Отправить</Button>
                  <label className="inline-flex h-8 cursor-pointer items-center rounded border border-[#d5dde5] px-3 text-[13px]">
                    Файл
                    <input
                      className="hidden"
                      type="file"
                      disabled={crm.readOnly}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) send(file.name);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <select
                    className={`${controlClass} w-auto`}
                    value={active.assigneeId ?? ""}
                    disabled={crm.readOnly}
                    onChange={(event) => {
                      const result = crm.assignConversation(active.id, event.target.value || null);
                      if (!result.ok) setError(result.error);
                    }}
                  >
                    <option value="">Передать…</option>
                    {dispatchers.map((user) => <option key={user.id} value={user.id}>{fullName(user)}</option>)}
                  </select>
                </div>
                <div className="mt-2"><ErrorText>{error}</ErrorText></div>
              </form>
            </>
          )}
        </section>
        <aside className={`${mobile === "list" ? "hidden" : "block"} min-h-0 overflow-y-auto border-[#e3e8ee] lg:block lg:border-l`}>
          {!active || !customer ? null : (
            <div className="space-y-4 p-4 text-sm">
              <div>
                <p className="text-xs text-[#828b95]">Клиент</p>
                <p className="mt-1 font-semibold">{customer.name}</p>
                <p>{customer.phone}</p>
                <p className="text-[#667085]">{customer.city}</p>
                <Button className="mt-2" variant="secondary" type="button" disabled={crm.readOnly} onClick={() => setOrderForm(true)}>Создать заказ</Button>
              </div>
              <div>
                <p className="text-xs text-[#828b95]">Источник</p>
                <p className="mt-1 font-semibold">{SOURCE_LABEL[active.source]}</p>
                <p className="text-[#667085]">Канал: {CHANNEL_LABEL[active.channel]}</p>
                {active.sourceDetail ? <p className="text-[#667085]">{active.sourceDetail}</p> : null}
                <p className="text-[#667085]">Первое обращение: {formatDateTime(active.createdAt)}</p>
              </div>
              <Field label="Статус">
                <select className={controlClass} value={active.status} disabled={crm.readOnly} onChange={(event) => crm.setRequestStatus(active.id, event.target.value as RequestStatus)}>
                  {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
                </select>
              </Field>
              <Field label="Ответственный">
                <p className="font-semibold">{active.assigneeId ? fullName(crm.state.users.find((user) => user.id === active.assigneeId) ?? { firstName: "—", lastName: "" }) : "Не назначен"}</p>
              </Field>
              <form className="space-y-2" onSubmit={(event) => {
                event.preventDefault();
                const result = crm.setSource(active.id, nextSource, sourceReason);
                if (!result.ok) setError(result.error);
                else { setSourceReason(""); setError(""); }
              }}>
                <Field label="Указать источник вручную">
                  <select className={controlClass} value={nextSource} onChange={(event) => setNextSource(event.target.value as SourceKind)}>
                    {SOURCE_OPTIONS.map((item) => <option key={item} value={item}>{SOURCE_LABEL[item]}</option>)}
                  </select>
                </Field>
                <textarea className={`${controlClass} h-16 py-2`} placeholder="Почему меняется источник" value={sourceReason} onChange={(event) => setSourceReason(event.target.value)} />
                <Button variant="secondary" type="submit" disabled={crm.readOnly}>Сохранить источник</Button>
              </form>
              <div>
                <p className="text-xs text-[#828b95]">История источника</p>
                <ul className="mt-2 space-y-2">
                  {crm.state.sourceChanges.filter((change) => change.conversationId === active.id).map((change) => (
                    <li key={change.id} className="rounded-[10px] bg-[#f7f8fa] px-3 py-2">
                      {SOURCE_LABEL[change.from]} → {SOURCE_LABEL[change.to]}
                      <span className="block text-[#667085]">{change.reason}</span>
                    </li>
                  ))}
                  {crm.state.sourceChanges.every((change) => change.conversationId !== active.id) ? <li className="text-[#667085]">Изменений не было</li> : null}
                </ul>
              </div>
              <div>
                <p className="text-xs text-[#828b95]">Другие обращения</p>
                <ul className="mt-2 space-y-2">
                  {customerConversations(crm.state, customer.id, active.id).map((conversation) => (
                    <li key={conversation.id}>
                      <button className="text-left crm-link" onClick={() => choose(conversation.id)} type="button">
                        {formatDateTime(conversation.createdAt)} · {SOURCE_LABEL[conversation.source]}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-[#828b95]">Заметки</p>
                <ul className="mt-2 space-y-2">
                  {crm.state.notes.filter((item) => item.conversationId === active.id).map((item) => {
                    const author = crm.state.users.find((user) => user.id === item.authorId);
                    return <li key={item.id} className="rounded-[10px] bg-[#f7f8fa] px-3 py-2">{item.text}<span className="mt-1 block text-[#667085]">{author ? fullName(author) : ""} · {formatDateTime(item.at)}</span></li>;
                  })}
                </ul>
                <form className="mt-2 space-y-2" onSubmit={(event) => {
                  event.preventDefault();
                  const result = crm.addNote(active.id, note);
                  if (!result.ok) setError(result.error);
                  else setNote("");
                }}>
                  <textarea className={`${controlClass} h-16 py-2`} value={note} disabled={crm.readOnly} onChange={(event) => setNote(event.target.value)} placeholder="Внутренняя заметка" />
                  <Button variant="secondary" type="submit" disabled={crm.readOnly}>Добавить</Button>
                </form>
              </div>
            </div>
          )}
        </aside>
      </div>
      {hidden ? <p className="text-sm text-[#667085]">Этот чат недоступен для вашей роли.</p> : null}
      {orderForm && active && customer ? (
        <OrderForm
          onClose={() => setOrderForm(false)}
          preset={{
            phone: customer.phone,
            name: customer.name,
            source: orderSourceFromConversation(active.source),
            conversationId: active.id,
          }}
        />
      ) : null}
    </div>
  );
}
