"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, ErrorText, Field, Modal, controlClass } from "@/components/ui";
import { allows } from "@/lib/access";
import { fullName, ORDER_STATUS_LABEL } from "@/lib/labels";
import { driverDuty, phoneDigits } from "@/lib/orders";
import {
  DOC_KINDS,
  DOC_LABEL,
  DOC_STATUS_LABEL,
  PIPELINE,
  SOURCE_LEAD_LABEL,
  STAGE_LABEL,
  STOP_LABEL,
  canEditDriver,
  canSeeDriver,
  hasFirstOrder,
  reachedStage,
} from "@/lib/recruitment";
import { useCrm } from "@/lib/store";
import { bishkekDateString, formatDate, formatDateTime, formatTime } from "@/lib/time";
import type { DocStatus, Driver, Order, RecruitStage, StopReason } from "@/lib/types";

const TABS = [
  { id: "info", label: "Общая информация" },
  { id: "history", label: "История действий" },
  { id: "messages", label: "Звонки и сообщения" },
  { id: "orders", label: "Заказы" },
  { id: "finance", label: "Финансы" },
  { id: "notes", label: "Заметки" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DriverCard({ id }: { id: string }) {
  const crm = useCrm();
  const router = useRouter();
  const user = crm.user;
  const driver = crm.state.drivers.find((item) => item.id === id);
  const [tab, setTab] = useState<TabId>("info");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [stop, setStop] = useState<StopReason>("no_answer");
  const [stopNote, setStopNote] = useState("");
  const [note, setNote] = useState("");
  const [task, setTask] = useState("");
  const [due, setDue] = useState("");
  const [score, setScore] = useState("5");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");
  if (!user) return null;
  const listHref = crm.isAdmin ? "/employees" : "/drivers";
  if (!driver || !canSeeDriver(driver, user.id, allows(user.role, "drivers.view_all"))) {
    return <p className="text-sm text-[#667085]">Карточка недоступна. <Link href={listHref} className="text-[#1d5fa7]">К списку</Link></p>;
  }
  const editable = !crm.readOnly && canEditDriver(driver, user.id, allows(user.role, "drivers.view_all"));
  const owner = crm.state.users.find((item) => item.id === driver.ownerId);
  const notes = crm.state.driverNotes.filter((item) => item.driverId === driver.id);
  const orders = crm.state.orders.filter((item) => item.driverId === driver.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const done = orders.filter((order) => order.status === "done");
  const turnover = done.reduce((sum, order) => sum + (order.price ?? 0), 0);
  const priced = done.filter((order) => order.price != null).length;
  const duty = driverDuty(crm.state.orders, driver);
  const active = driver.stage !== "stopped" && driver.availability !== "offline";
  const step = PIPELINE.filter((stage) => reachedStage(driver, stage, crm.state.orders)).length;
  const firstAt = firstOrderAt(driver, orders);
  const digits = phoneDigits(driver.phone);
  const customers = digits.length >= 6 ? crm.state.customers.filter((item) => phoneDigits(item.phone) === digits) : [];
  const chats = crm.state.conversations.filter((item) => customers.some((customer) => customer.id === item.customerId));
  const messages = crm.state.messages.filter((item) => chats.some((chat) => chat.id === item.conversationId)).sort((a, b) => b.at.localeCompare(a.at));
  const tasks = crm.state.driverTasks.filter((item) => item.driverId === driver.id && !item.doneAt);
  const orderIds = new Set(orders.map((order) => order.id));
  const events = crm.state.orderEvents.filter((item) => orderIds.has(item.orderId));

  function run(result: { ok: boolean; error?: string }) {
    setError(result.ok ? "" : result.error ?? "Не сохранено");
    return result.ok;
  }

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(driver!.phone);
      setCopied(true);
    } catch {
      setError("Не удалось скопировать телефон");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={listHref} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e6e8ec] bg-white text-[#52606d] hover:bg-[#f4f6f8]" aria-label="К списку водителей">←</Link>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Карточка водителя</h2>
            <p className="text-xs text-[#98a2b3]">ID {driver.id}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-[#e7f6ee] text-[#1f7a45]" : "bg-[#f4f6f8] text-[#667085]"}`}>{active ? "Активен" : "Неактивен"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!editable} onClick={() => { setEditing((value) => !value); setTab("info"); }}>{editing ? "Закрыть" : "Редактировать"}</Button>
          <Link href={`/chats?q=${encodeURIComponent(driver.phone)}`} className="inline-flex h-9 items-center rounded-lg border border-[#e6e8ec] bg-white px-3 text-sm hover:bg-[#f4f6f8]">Написать</Link>
          <a href={`tel:${driver.phone.replace(/\s/g, "")}`} className="inline-flex h-9 items-center rounded-lg bg-[#1d5fa7] px-3 text-sm font-medium text-white hover:bg-[#184f8c]">Позвонить</a>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>

      <section className="crm-panel p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_240px]">
          <div className="flex gap-3">
            <PhotoSlide
              photos={driver.photos ?? []}
              label="Фото водителя"
              variant="portrait"
              editable={editable}
              empty={<Avatar name={fullName(driver)} id={driver.id} online={active} />}
              onChange={(photos) => run(crm.saveDriverProfile(driver.id, { photos }))}
              onError={setError}
            />
            <div className="min-w-0">
              <h3 className="text-xl font-semibold">{fullName(driver)}{driver.demo ? <span className="ml-2 text-sm font-normal text-[#98a2b3]">демо</span> : null}</h3>
              <p className="mt-1 flex items-center gap-2 text-sm text-[#52606d]">
                <a className="text-[#1d5fa7]" href={`tel:${driver.phone.replace(/\s/g, "")}`}>{driver.phone}</a>
                <button type="button" className="text-xs text-[#667085] underline" onClick={copyPhone}>{copied ? "Скопировано" : "Копировать"}</button>
              </p>
              <p className="mt-2 text-sm text-[#667085]">{driver.city || "Город не указан"} · {driver.carModel || driver.vehicle || "Авто не указано"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Fact label="Диспетчер" value={owner ? fullName(owner) : "Не закреплён"} />
            <Fact label="Дата регистрации" value={formatDateTime(driver.createdAt)} />
            <Fact label="Источник" value={SOURCE_LEAD_LABEL[driver.source]} />
            <Fact label="Ответственный" value={owner ? fullName(owner) : "Очередь"} />
          </dl>
          <div className="rounded-xl border border-[#e6e8ec] bg-[#f8fafc] p-3">
            <p className="text-xs text-[#667085]">Текущий статус</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium">
              <span className={`h-2 w-2 rounded-full ${active ? "bg-[#1f7a45]" : "bg-[#98a2b3]"}`} />
              {duty === "busy" ? "На заказе" : driver.stage === "stopped" ? "Остановлен" : active ? "Активен" : "Не на линии"}
            </p>
            <label className="mt-3 block text-xs text-[#667085]">
              Этап
              <select className={`${controlClass} mt-1 !bg-white`} disabled={!editable} value={driver.stage === "stopped" ? "" : driver.stage} onChange={(event) => run(crm.setRecruitStage(driver.id, event.target.value as RecruitStage))}>
                {driver.stage === "stopped" ? <option value="">Остановлен</option> : null}
                {PIPELINE.map((item) => <option key={item} value={item}>{STAGE_LABEL[item]}</option>)}
              </select>
            </label>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e6e8ec]">
              <div className={`h-full ${driver.stage === "stopped" ? "bg-[#d1435b]" : "bg-[#1f7a45]"}`} style={{ width: `${Math.round((step / PIPELINE.length) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-[#667085]">{step} / {PIPELINE.length} этапов</p>
            <p className="mt-2 text-xs text-[#667085]">Дата 1-го заказа</p>
            <p className="text-sm">{firstAt ? formatDateTime(firstAt) : "Ещё не было"}</p>
            {editable ? <button type="button" className="mt-3 text-xs text-[#b42318]" onClick={() => setStopOpen((value) => !value)}>{stopOpen ? "Скрыть остановку" : "Остановить"}</button> : null}
          </div>
        </div>
        {stopOpen && editable ? (
          <form className="mt-4 flex flex-wrap items-end gap-2 border-t border-[#e6e8ec] pt-3" onSubmit={(event) => { event.preventDefault(); if (run(crm.setRecruitStage(driver.id, "stopped", stop, stopNote))) setStopOpen(false); }}>
            <Field label="Причина остановки">
              <select className={controlClass} value={stop} onChange={(event) => setStop(event.target.value as StopReason)}>
                {(Object.keys(STOP_LABEL) as StopReason[]).map((item) => <option key={item} value={item}>{STOP_LABEL[item]}</option>)}
              </select>
            </Field>
            <Field label="Комментарий"><input className={controlClass} value={stopNote} onChange={(event) => setStopNote(event.target.value)} /></Field>
            <Button type="submit" variant="danger">Остановить</Button>
          </form>
        ) : null}
        {driver.stopReason ? <p className="mt-3 text-sm text-[#b42318]">Остановлен: {STOP_LABEL[driver.stopReason]}{driver.stopNote ? ` · ${driver.stopNote}` : ""}</p> : null}
      </section>

      <section className="crm-panel overflow-x-auto p-4">
        <ol className="flex min-w-[720px] items-start">
          {PIPELINE.map((stage, index) => {
            const doneStage = reachedStage(driver, stage, crm.state.orders);
            const mark = driver.stageLog.find((item) => item.stage === stage);
            return (
              <li key={stage} className="flex min-w-0 flex-1 items-start">
                <div className="min-w-0">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white ${doneStage ? "bg-[#1f7a45]" : "bg-[#d0d5dd]"}`}>{doneStage ? "✓" : index + 1}</span>
                  <p className="mt-2 text-sm font-medium">{STAGE_LABEL[stage]}</p>
                  <p className="text-xs text-[#98a2b3]">{mark ? `${formatDate(mark.at)} ${formatTime(mark.at)}` : doneStage ? "пройден" : "ещё нет"}</p>
                </div>
                {index < PIPELINE.length - 1 ? <span className={`mx-2 mt-3 h-0.5 flex-1 ${doneStage ? "bg-[#1f7a45]" : "bg-[#e6e8ec]"}`} /> : null}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex gap-1 overflow-x-auto border-b border-[#e6e8ec]">
        {TABS.map((item) => {
          const count = item.id === "orders" ? orders.length : item.id === "messages" ? messages.length : item.id === "notes" ? notes.length : 0;
          const selected = tab === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`shrink-0 border-b-2 px-3 py-2 text-sm ${selected ? "border-[#1d5fa7] font-medium text-[#1d5fa7]" : "border-transparent text-[#667085] hover:text-[#1f2933]"}`}>
              {item.label}{count ? <span className="ml-1 rounded-full bg-[#e8f1fb] px-1.5 text-xs text-[#1d5fa7]">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {tab === "info" ? <Info driver={driver} orders={orders} turnover={turnover} editing={editing} editable={editable} onError={setError} onOrders={() => setTab("orders")} onNotes={() => setTab("notes")} /> : null}
      {tab === "history" ? <History driver={driver} notes={notes} events={events} users={crm.state.users} /> : null}
      {tab === "messages" ? <Messages messages={messages} chats={chats.length} phone={driver.phone} /> : null}
      {tab === "orders" ? <Orders orders={orders} /> : null}
      {tab === "finance" ? <Finance count={done.length} priced={priced} turnover={turnover} total={orders.length} /> : null}
      {tab === "notes" ? (
        <Notes
          notes={notes}
          tasks={tasks}
          users={crm.state.users}
          editable={editable}
          note={note}
          task={task}
          due={due}
          now={crm.now}
          onNote={setNote}
          onTask={setTask}
          onDue={setDue}
          onAddNote={() => { if (run(crm.addDriverNote(driver.id, note))) setNote(""); }}
          onAddTask={() => { if (run(crm.addDriverTask(driver.id, task, due ? new Date(`${due}:00+06:00`).toISOString() : "", "high"))) setTask(""); }}
          onDone={(taskId) => run(crm.completeDriverTask(taskId))}
        />
      ) : null}

      {crm.isAdmin && tab === "info" ? (
        <section className="crm-panel flex flex-wrap items-center gap-2 p-4">
          <h3 className="mr-2 text-sm font-semibold">Оценка диспетчера</h3>
          <select className={`${controlClass} !w-auto`} value={score} onChange={(event) => setScore(event.target.value)} aria-label="Оценка">
            {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <Button variant="secondary" disabled={!driver.ownerId} onClick={() => driver.ownerId && run(crm.recordRating(driver.id, driver.ownerId, Number(score)))}>Записать</Button>
          {allows(user.role, "drivers.delete") ? <Button variant="danger" onClick={() => setConfirmDelete(true)}>Удалить водителя</Button> : null}
        </section>
      ) : null}

      {confirmDelete ? (
        <Modal title="Удалить водителя?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-[#52606d]">Открытый заказ удаление блокирует.</p>
          <input className={`${controlClass} mt-3`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Причина" />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>Отмена</Button>
            <Button type="button" variant="danger" onClick={() => { const result = crm.deleteDriver(driver.id, reason); if (!result.ok) { setError(result.error); setConfirmDelete(false); return; } router.push(listHref); }}>Удалить</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Info({ driver, orders, turnover, editing, editable, onError, onOrders, onNotes }: { driver: Driver; orders: Order[]; turnover: number; editing: boolean; editable: boolean; onError: (text: string) => void; onOrders: () => void; onNotes: () => void }) {
  const crm = useCrm();
  const [draft, setDraft] = useState({
    firstName: driver.firstName,
    lastName: driver.lastName,
    phone: driver.phone,
    city: driver.city,
    address: driver.address,
    citizenship: driver.citizenship,
    inn: driver.inn,
    licenseNumber: driver.licenseNumber,
    plate: driver.plate,
    carModel: driver.carModel,
    carColor: driver.carColor,
    carYear: driver.carYear ? String(driver.carYear) : "",
    carCategory: driver.carCategory,
    pitchNoted: driver.pitchNoted,
  });
  const days = recentDays(crm.now || Date.now(), 14);
  const counts = days.map((day) => orders.filter((order) => bishkekDateString(new Date(order.createdAt)) === day).length);
  const max = Math.max(1, ...counts);
  const notes = crm.state.driverNotes.filter((item) => item.driverId === driver.id);
  const tasks = crm.state.driverTasks.filter((item) => item.driverId === driver.id && !item.doneAt);

  function save(event: FormEvent) {
    event.preventDefault();
    const result = crm.saveDriverProfile(driver.id, { ...draft, carYear: draft.carYear ? Number(draft.carYear) : null });
    onError(result.ok ? "" : result.error);
  }

  return (
    <div className="space-y-4">
      <form className="grid gap-4 xl:grid-cols-3" onSubmit={save}>
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Основная информация</h3>
          <div className="mt-3 space-y-2 text-sm">
            {editing ? (
              <>
                <Field label="Имя"><input className={controlClass} value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} /></Field>
                <Field label="Фамилия"><input className={controlClass} value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></Field>
                <Field label="Телефон"><input className={controlClass} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field>
                <Field label="Город"><input className={controlClass} value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></Field>
                <Field label="Адрес"><input className={controlClass} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></Field>
                <Field label="Гражданство"><input className={controlClass} value={draft.citizenship} onChange={(event) => setDraft({ ...draft, citizenship: event.target.value })} /></Field>
                <Field label="ИНН"><input className={controlClass} value={draft.inn} onChange={(event) => setDraft({ ...draft, inn: event.target.value })} /></Field>
                <Field label="Номер ВУ"><input className={controlClass} value={draft.licenseNumber} onChange={(event) => setDraft({ ...draft, licenseNumber: event.target.value })} /></Field>
              </>
            ) : (
              <>
                <Row label="ФИО" value={fullName(driver)} />
                <Row label="Телефон" value={driver.phone} />
                <Row label="Город" value={driver.city || "—"} />
                <Row label="Адрес" value={driver.address || "—"} />
                <Row label="Гражданство" value={driver.citizenship || "—"} />
                <Row label="ИНН" value={driver.inn || "—"} />
                <Row label="Права" value={driver.licenseNumber || "—"} />
              </>
            )}
          </div>
        </section>
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Автомобиль</h3>
          <div className="mt-3">
            <PhotoSlide
              photos={driver.carPhotos ?? []}
              label="Фото машины"
              variant="wide"
              editable={editable}
              onChange={(photos) => { const result = crm.saveDriverProfile(driver.id, { carPhotos: photos }); onError(result.ok ? "" : result.error); }}
              onError={onError}
            />
          </div>
          <p className="mt-3 text-lg font-medium">{driver.carModel || driver.vehicle || "Марка не указана"}</p>
          <div className="mt-3 space-y-2 text-sm">
            {editing ? (
              <>
                <Field label="Марка и модель"><input className={controlClass} value={draft.carModel} onChange={(event) => setDraft({ ...draft, carModel: event.target.value })} /></Field>
                <Field label="Госномер"><input className={controlClass} value={draft.plate} onChange={(event) => setDraft({ ...draft, plate: event.target.value })} /></Field>
                <Field label="Цвет"><input className={controlClass} value={draft.carColor} onChange={(event) => setDraft({ ...draft, carColor: event.target.value })} /></Field>
                <Field label="Год"><input className={controlClass} value={draft.carYear} onChange={(event) => setDraft({ ...draft, carYear: event.target.value })} /></Field>
                <Field label="Категория"><input className={controlClass} value={draft.carCategory} onChange={(event) => setDraft({ ...draft, carCategory: event.target.value })} /></Field>
                <label className="flex items-center gap-2"><input type="checkbox" checked={draft.pitchNoted} onChange={(event) => setDraft({ ...draft, pitchNoted: event.target.checked })} /> УТП парка донесено</label>
              </>
            ) : (
              <>
                <Row label="Гос. номер" value={driver.plate || "—"} />
                <Row label="Цвет" value={driver.carColor || "—"} />
                <Row label="Год" value={driver.carYear ? String(driver.carYear) : "—"} />
                <Row label="Категория" value={driver.carCategory || "—"} />
                <Row label="УТП" value={driver.pitchNoted ? "Донесено" : "Не отмечено"} />
              </>
            )}
          </div>
          {editing && editable ? <Button type="submit" className="mt-3">Сохранить</Button> : null}
        </section>
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Статистика</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Всего заказов" value={String(orders.length)} />
            <Stat label="Выполнено" value={String(orders.filter((order) => order.status === "done").length)} />
            <Stat label="Сумма" value={money(turnover)} />
            <Stat label="С ценой" value={String(orders.filter((order) => order.status === "done" && order.price != null).length)} />
          </div>
          <div className="mt-4 flex h-24 items-end gap-1">
            {counts.map((count, index) => (
              <span key={days[index]} className="flex-1 rounded-sm bg-[#2f7bff]" style={{ height: `${count === 0 ? 6 : Math.max(12, (count / max) * 100)}%`, opacity: count === 0 ? 0.25 : 1 }} title={`${days[index]}: ${count}`} />
            ))}
          </div>
          <p className="mt-1 text-xs text-[#98a2b3]">Заказы за 14 дней</p>
        </section>
      </form>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Документы</h3>
          <p className="mt-1 text-xs text-[#98a2b3]">Сканы не хранятся. Меняется статус проверки.</p>
          <ul className="mt-3 space-y-2">
            {DOC_KINDS.map((kind) => (
              <li key={kind} className="flex items-center justify-between gap-2 text-sm">
                <span>{DOC_LABEL[kind]}</span>
                <select className={`${controlClass} !w-auto`} disabled={!editable} value={driver.docs[kind]} aria-label={DOC_LABEL[kind]} onChange={(event) => { const result = crm.setDriverDoc(driver.id, kind, event.target.value as DocStatus); onError(result.ok ? "" : result.error); }}>
                  {(Object.keys(DOC_STATUS_LABEL) as DocStatus[]).map((item) => <option key={item} value={item}>{DOC_STATUS_LABEL[item]}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </section>
        <section className="crm-panel p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Последние заказы</h3>
            <button type="button" className="text-xs text-[#1d5fa7]" onClick={onOrders}>Все заказы</button>
          </div>
          {orders.length === 0 ? <p className="mt-3 text-sm text-[#667085]">Заказов нет</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {orders.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <Link href={`/orders?order=${order.id}`} className="font-medium text-[#1d5fa7]">№{order.number}</Link>
                  <span className="mt-0.5 block text-xs text-[#667085]">{formatDateTime(order.createdAt)} · {order.pickup || "адрес не указан"} · {order.price != null ? money(order.price) : "без суммы"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="crm-panel p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Заметки</h3>
            <button type="button" className="text-xs text-[#1d5fa7]" onClick={onNotes}>Все заметки</button>
          </div>
          {tasks.slice(0, 2).map((item) => (
            <p key={item.id} className="mt-3 rounded-lg border border-[#f3e2c2] bg-[#fff8ee] px-3 py-2 text-sm">{item.title}<span className="mt-0.5 block text-xs text-[#8a5a00]">до {formatDateTime(item.dueAt)}</span></p>
          ))}
          {notes.length === 0 && tasks.length === 0 ? <p className="mt-3 text-sm text-[#667085]">Заметок нет</p> : notes.slice(0, 3).map((item) => (
            <p key={item.id} className="mt-3 text-sm">{item.text}<span className="mt-0.5 block text-xs text-[#98a2b3]">{formatDateTime(item.at)}</span></p>
          ))}
        </section>
      </div>
    </div>
  );
}

function History({ driver, notes, events, users }: { driver: Driver; notes: { id: string; authorId: string; text: string; at: string }[]; events: { id: string; detail: string; at: string; actorId: string }[]; users: { id: string; firstName: string; lastName: string }[] }) {
  const rows = [
    ...driver.stageLog.map((item, index) => ({ id: `stage-${index}`, at: item.at, title: STAGE_LABEL[item.stage], meta: "Этап" })),
    ...notes.map((item) => ({ id: item.id, at: item.at, title: item.text, meta: users.find((user) => user.id === item.authorId) ? fullName(users.find((user) => user.id === item.authorId)!) : "Заметка" })),
    ...events.map((item) => ({ id: item.id, at: item.at, title: item.detail, meta: "Заказ" })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  if (rows.length === 0) return <p className="text-sm text-[#667085]">Истории пока нет</p>;
  return (
    <ul className="crm-panel divide-y divide-[#e6e8ec]">
      {rows.map((item) => (
        <li key={item.id} className="px-4 py-3 text-sm">
          <span className="font-medium">{item.title}</span>
          <span className="mt-0.5 block text-xs text-[#98a2b3]">{formatDateTime(item.at)} · {item.meta}</span>
        </li>
      ))}
    </ul>
  );
}

function Messages({ messages, chats, phone }: { messages: { id: string; text: string; at: string; direction: "in" | "out" }[]; chats: number; phone: string }) {
  return (
    <section className="crm-panel p-4">
      <p className="text-sm text-[#667085]">Телефония не подключена, поэтому записей звонков нет. Чатов по номеру {phone}: {chats}.</p>
      <Link href={`/chats?q=${encodeURIComponent(phone)}`} className="mt-2 inline-block text-sm text-[#1d5fa7]">Открыть чаты</Link>
      {messages.length === 0 ? <p className="mt-3 text-sm text-[#667085]">Сообщений нет</p> : (
        <ul className="mt-3 space-y-2">
          {messages.slice(0, 20).map((item) => (
            <li key={item.id} className="rounded-lg border border-[#e6e8ec] px-3 py-2 text-sm">
              <span className="text-xs text-[#98a2b3]">{item.direction === "in" ? "Входящее" : "Исходящее"} · {formatDateTime(item.at)}</span>
              <span className="mt-1 block">{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Orders({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <p className="text-sm text-[#667085]">Заказов нет</p>;
  return (
    <div className="crm-panel overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[#f7f8fa] text-[#667085]">
          <tr>{["Номер", "Время", "Подача", "Назначение", "Сумма", "Статус"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-[#e6e8ec]">
              <td className="px-3 py-2"><Link href={`/orders?order=${order.id}`} className="text-[#1d5fa7]">№{order.number}</Link></td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
              <td className="px-3 py-2">{order.pickup || "—"}</td>
              <td className="px-3 py-2">{order.dropoff || "—"}</td>
              <td className="px-3 py-2">{order.price != null ? money(order.price) : "—"}</td>
              <td className="px-3 py-2">{ORDER_STATUS_LABEL[order.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Finance({ count, priced, turnover, total }: { count: number; priced: number; turnover: number; total: number }) {
  return (
    <section className="crm-panel p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Заказов всего" value={String(total)} />
        <Stat label="Выполнено" value={String(count)} />
        <Stat label="Сумма выполненных" value={money(turnover)} />
      </div>
      <p className="mt-3 text-sm text-[#667085]">Цены есть у {priced} выполненных заказов. Комиссия парка и вывод на банк появятся после подключения Akjol Drive.</p>
    </section>
  );
}

function Notes({ notes, tasks, users, editable, note, task, due, now, onNote, onTask, onDue, onAddNote, onAddTask, onDone }: {
  notes: { id: string; authorId: string; text: string; at: string }[];
  tasks: { id: string; title: string; dueAt: string }[];
  users: { id: string; firstName: string; lastName: string }[];
  editable: boolean;
  note: string;
  task: string;
  due: string;
  now: number;
  onNote: (value: string) => void;
  onTask: (value: string) => void;
  onDue: (value: string) => void;
  onAddNote: () => void;
  onAddTask: () => void;
  onDone: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="crm-panel p-4">
        <h3 className="font-semibold">Заметки</h3>
        {editable ? (
          <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); onAddNote(); }}>
            <input className={controlClass} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Заметка" />
            <Button type="submit">Добавить</Button>
          </form>
        ) : null}
        {notes.length === 0 ? <p className="mt-3 text-sm text-[#667085]">Заметок нет</p> : (
          <ul className="mt-3 space-y-2">
            {notes.map((item) => {
              const author = users.find((user) => user.id === item.authorId);
              return <li key={item.id} className="text-sm">{item.text}<span className="mt-0.5 block text-xs text-[#98a2b3]">{author ? fullName(author) : "сотрудник"} · {formatDateTime(item.at)}</span></li>;
            })}
          </ul>
        )}
      </section>
      <section className="crm-panel p-4">
        <h3 className="font-semibold">Напоминания</h3>
        {editable ? (
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); onAddTask(); }}>
            <input className={`${controlClass} min-w-[180px] flex-1`} value={task} onChange={(event) => onTask(event.target.value)} placeholder="Перезвонить, проверить ВУ" />
            <input className={`${controlClass} !w-auto`} type="datetime-local" value={due} onChange={(event) => onDue(event.target.value)} />
            <Button type="submit">Поставить</Button>
          </form>
        ) : null}
        {tasks.length === 0 ? <p className="mt-3 text-sm text-[#667085]">Открытых напоминаний нет</p> : tasks.map((item) => (
          <div key={item.id} className="mt-3 flex items-center justify-between gap-2 text-sm">
            <span>{item.title}<span className={`mt-0.5 block text-xs ${new Date(item.dueAt).getTime() < now ? "text-[#b42318]" : "text-[#98a2b3]"}`}>{formatDateTime(item.dueAt)}</span></span>
            {editable ? <Button className="h-8" variant="secondary" onClick={() => onDone(item.id)}>Готово</Button> : null}
          </div>
        ))}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-[#98a2b3]">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <p className="flex justify-between gap-3 border-b border-[#f2f4f7] py-1.5"><span className="text-[#667085]">{label}</span><span className="text-right">{value}</span></p>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-[#f7f8fa] px-3 py-2"><p className="text-xs text-[#667085]">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>;
}

function PhotoSlide({
  photos,
  label,
  variant,
  editable,
  empty,
  onChange,
  onError,
}: {
  photos: string[];
  label: string;
  variant: "portrait" | "wide";
  editable: boolean;
  empty?: ReactNode;
  onChange: (photos: string[]) => void;
  onError: (text: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const current = photos.length === 0 ? 0 : Math.min(index, photos.length - 1);
  const portrait = variant === "portrait";
  const frame = portrait ? "h-40 w-32" : "h-48 w-full";

  async function add(files: FileList | null) {
    if (!files?.length) return;
    try {
      const next = [...photos];
      for (const file of Array.from(files)) {
        if (next.length >= 6) break;
        if (!file.type.startsWith("image/")) continue;
        next.push(await shrinkPhoto(file));
      }
      if (next.length === photos.length) {
        onError("Выберите изображение");
        return;
      }
      onChange(next);
      setIndex(next.length - 1);
      onError("");
    } catch {
      onError("Не удалось прочитать фото");
    }
  }

  return (
    <div className={portrait ? "w-32 shrink-0" : "w-full"}>
      <div className={`relative overflow-hidden rounded-2xl border border-[#e6e8ec] bg-white ${frame}`}>
        {photos.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[current]} alt={label} className="h-full w-full bg-white object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#f7f8fa]">{empty ?? <span className="px-3 text-center text-sm text-[#98a2b3]">Нет фото</span>}</div>
        )}
        {!portrait && photos.length > 1 ? (
          <>
            <button type="button" className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[#e6e8ec] bg-white text-[#1f2933] shadow-sm" aria-label="Предыдущее фото" onClick={() => setIndex((current + photos.length - 1) % photos.length)}>‹</button>
            <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[#e6e8ec] bg-white text-[#1f2933] shadow-sm" aria-label="Следующее фото" onClick={() => setIndex((current + 1) % photos.length)}>›</button>
          </>
        ) : null}
        {!portrait && photos.length > 0 ? <span className="absolute bottom-2 right-2 rounded-full bg-white px-2 py-0.5 text-xs text-[#344054] shadow-sm">{current + 1} / {photos.length}</span> : null}
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        {portrait && photos.length > 1 ? (
          <span className="flex gap-1">
            <button type="button" className="grid h-6 w-6 place-items-center rounded-full border border-[#e6e8ec] bg-white text-sm" aria-label="Предыдущее фото" onClick={() => setIndex((current + photos.length - 1) % photos.length)}>‹</button>
            <button type="button" className="grid h-6 w-6 place-items-center rounded-full border border-[#e6e8ec] bg-white text-sm" aria-label="Следующее фото" onClick={() => setIndex((current + 1) % photos.length)}>›</button>
          </span>
        ) : <span />}
        {portrait && photos.length > 0 ? <span className="text-xs text-[#667085]">{current + 1}/{photos.length}</span> : null}
        {editable ? (
          <span className="ml-auto flex gap-2 text-xs">
            <label className="cursor-pointer text-[#1d5fa7]">
              Добавить
              <input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => { void add(event.target.files); event.target.value = ""; }} />
            </label>
            {photos.length > 0 ? <button type="button" className="text-[#b42318]" onClick={() => { const next = photos.filter((_, item) => item !== current); onChange(next); setIndex(0); }}>Удалить</button> : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function shrinkPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const max = 720;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
}

function Avatar({ name, id, online }: { name: string; id: string; online: boolean }) {
  const colors = ["#2563eb", "#0f766e", "#7c3aed", "#b45309", "#be123c"];
  let hash = 0;
  for (const char of id) hash += char.charCodeAt(0);
  const letter = name.trim().slice(0, 1).toUpperCase() || "—";
  return (
    <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-semibold text-white" style={{ background: colors[hash % colors.length] }}>
      {letter}
      <span className={`absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-white ${online ? "bg-[#1f7a45]" : "bg-[#98a2b3]"}`} />
    </span>
  );
}

function money(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} сом`;
}

function firstOrderAt(driver: Driver, orders: Order[]) {
  const fromLog = [...driver.stageLog].reverse().find((item) => item.stage === "first_order")?.at;
  const done = orders.filter((order) => order.status === "done").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.createdAt;
  return fromLog ?? done ?? null;
}

function recentDays(now: number, count: number) {
  const days: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) days.push(bishkekDateString(new Date(now - index * 24 * 60 * 60 * 1000)));
  return days;
}
