"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Modal, controlClass } from "@/components/ui";
import { allows } from "@/lib/access";
import { fullName, ORDER_STATUS_LABEL } from "@/lib/labels";
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
  isOverdue,
} from "@/lib/recruitment";
import { useCrm } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import type { DocStatus, LeadSource, RecruitStage, StopReason } from "@/lib/types";

export function DriversScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  if (id) return <DriverCard id={id} />;
  return <DriverList />;
}

function DriverList() {
  const crm = useCrm();
  const router = useRouter();
  const user = crm.user;
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"all" | RecruitStage>("all");
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", city: "Бишкек", source: "phone" as LeadSource });
  if (!user) return null;
  const viewAll = allows(user.role, "drivers.view_all");
  const needle = query.trim().toLowerCase();
  const rows = crm.state.drivers.filter((driver) => {
    if (!canSeeDriver(driver, user.id, viewAll)) return false;
    if (stage !== "all" && driver.stage !== stage) return false;
    if (mine && driver.ownerId !== user.id) return false;
    if (needle && !`${driver.firstName} ${driver.lastName} ${driver.phone}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const tasks = crm.state.driverTasks.filter((task) => !task.doneAt && (viewAll || task.assigneeId === user.id));
  const overdue = tasks.filter((task) => isOverdue(task, crm.now));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Водители</h2>
          <p className="text-sm text-[#667085]">Заявки, которые вы ведёте, и свободная очередь. Чужие закреплённые карточки скрыты.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={crm.readOnly || !allows(user.role, "drivers.edit")}>Новая заявка</Button>
      </div>
      {overdue.length ? <p className="rounded-[10px] bg-[#fdecec] px-3 py-2 text-sm text-[#c24141]">Просроченных задач: {overdue.length}. Push-уведомления не подключены — список только на этом экране.</p> : null}
      <div className="flex flex-wrap gap-2">
        <input className={`${controlClass} max-w-xs`} placeholder="Имя или телефон" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className={`${controlClass} w-auto`} value={stage} onChange={(event) => setStage(event.target.value as typeof stage)}>
          <option value="all">Все этапы</option>
          {PIPELINE.map((item) => <option key={item} value={item}>{STAGE_LABEL[item]}</option>)}
          <option value="stopped">Остановлен</option>
        </select>
        <button type="button" className={`h-10 rounded-lg border px-3 text-sm ${mine ? "border-[#2e6db4] bg-[#e8f1fb]" : "border-[#e6e8ec] bg-white"}`} onClick={() => setMine((value) => !value)}>Только мои</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {PIPELINE.map((item) => (
          <button key={item} type="button" className="crm-panel px-3 py-2 text-left" onClick={() => setStage(item)}>
            <span className="block text-lg font-semibold tabular-nums">{rows.filter((driver) => driver.stage === item).length}</span>
            <span className="text-xs text-[#667085]">{STAGE_LABEL[item]}</span>
          </button>
        ))}
      </div>
      <section className="crm-panel overflow-x-auto">
        {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[#667085]">Заявок по этим условиям нет</p> : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["Водитель", "Телефон", "Этап", "Источник", "Диспетчер", ""].map((title) => <th key={title || "a"} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((driver) => {
                const owner = crm.state.users.find((item) => item.id === driver.ownerId);
                return (
                  <tr key={driver.id} className="border-t border-[#e6e8ec]">
                    <td className="px-3 py-2">
                      <Link href={`/drivers?id=${driver.id}`} className="font-medium text-[#1d5fa7]">{fullName(driver)}</Link>
                      {driver.demo ? <span className="ml-2 text-xs text-[#98a2b3]">демо</span> : null}
                    </td>
                    <td className="px-3 py-2">{driver.phone}</td>
                    <td className="px-3 py-2">{STAGE_LABEL[driver.stage]}{driver.stopReason ? ` · ${STOP_LABEL[driver.stopReason]}` : ""}</td>
                    <td className="px-3 py-2">{SOURCE_LEAD_LABEL[driver.source]}</td>
                    <td className="px-3 py-2">{owner ? fullName(owner) : "очередь"}</td>
                    <td className="px-3 py-2">{hasFirstOrder(driver, crm.state.orders) ? "1-й заказ есть" : "ещё нет"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {tasks.length ? (
        <section className="crm-panel">
          <h3 className="px-4 py-3 font-semibold">Задачи</h3>
          {tasks.map((task) => {
            const driver = crm.state.drivers.find((item) => item.id === task.driverId);
            return (
              <div key={task.id} className="flex items-center justify-between gap-2 border-t border-[#e6e8ec] px-4 py-2 text-sm">
                <span>
                  <span className={isOverdue(task, crm.now) ? "text-[#c24141]" : ""}>{task.title}</span>
                  <span className="mt-0.5 block text-xs text-[#667085]">{driver ? fullName(driver) : "водитель"} · {formatDateTime(task.dueAt)}{task.priority === "high" ? " · высокий" : ""}</span>
                </span>
                <Button className="h-8" variant="secondary" disabled={crm.readOnly} onClick={() => crm.completeDriverTask(task.id)}>Готово</Button>
              </div>
            );
          })}
        </section>
      ) : null}
      {open ? (
        <Modal title="Новая заявка" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            const result = crm.saveLead(form);
            if (!result.ok) { setError(result.error); return; }
            setOpen(false);
            if (result.orderId) router.push(`/drivers?id=${result.orderId}`);
          }}>
            <ErrorText>{error}</ErrorText>
            <Field label="Имя"><input className={controlClass} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></Field>
            <Field label="Фамилия"><input className={controlClass} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></Field>
            <Field label="Телефон"><input className={controlClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></Field>
            <Field label="Город"><input className={controlClass} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
            <Field label="Источник">
              <select className={controlClass} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as LeadSource })}>
                {(Object.keys(SOURCE_LEAD_LABEL) as LeadSource[]).map((item) => <option key={item} value={item}>{SOURCE_LEAD_LABEL[item]}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function DriverCard({ id }: { id: string }) {
  const crm = useCrm();
  const router = useRouter();
  const user = crm.user;
  const driver = crm.state.drivers.find((item) => item.id === id);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [task, setTask] = useState("");
  const [due, setDue] = useState("");
  const [stop, setStop] = useState<StopReason>("no_answer");
  const [stopNote, setStopNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");
  const [score, setScore] = useState("5");
  if (!user) return null;
  if (!driver || !canSeeDriver(driver, user.id, allows(user.role, "drivers.view_all"))) {
    return <p className="text-sm text-[#667085]">Карточка недоступна. <Link href={crm.isAdmin ? "/employees" : "/drivers"} className="text-[#1d5fa7]">К списку</Link></p>;
  }
  const editable = !crm.readOnly && canEditDriver(driver, user.id, allows(user.role, "drivers.view_all"));
  const owner = crm.state.users.find((item) => item.id === driver.ownerId);
  const notes = crm.state.driverNotes.filter((item) => item.driverId === driver.id);
  const orders = crm.state.orders.filter((item) => item.driverId === driver.id);
  const turnover = orders.filter((item) => item.status === "done").reduce((sum, item) => sum + (item.price ?? 0), 0);

  function run(result: { ok: boolean; error?: string }) {
    setError(result.ok ? "" : result.error ?? "Не сохранено");
  }

  return (
    <div className="space-y-3">
      <Link href={crm.isAdmin ? "/employees" : "/drivers"} className="text-sm text-[#1d5fa7]">← Все водители</Link>
      <ErrorText>{error}</ErrorText>
      <section className="crm-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{fullName(driver)} {driver.demo ? <span className="text-sm font-normal text-[#98a2b3]">демо</span> : null}</h2>
            <p className="text-sm text-[#667085]">{driver.phone} · {driver.city} · {STAGE_LABEL[driver.stage]}</p>
            <p className="text-sm text-[#667085]">Диспетчер: {owner ? fullName(owner) : "не закреплён"}</p>
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <select className={`${controlClass} w-auto`} value={driver.stage === "stopped" ? "" : driver.stage} onChange={(event) => run(crm.setRecruitStage(driver.id, event.target.value as RecruitStage))}>
                {PIPELINE.map((item) => <option key={item} value={item}>{STAGE_LABEL[item]}</option>)}
              </select>
            </div>
          ) : null}
        </div>
        {editable ? (
          <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); run(crm.setRecruitStage(driver.id, "stopped", stop, stopNote)); }}>
            <Field label="Причина остановки">
              <select className={controlClass} value={stop} onChange={(event) => setStop(event.target.value as StopReason)}>
                {(Object.keys(STOP_LABEL) as StopReason[]).map((item) => <option key={item} value={item}>{STOP_LABEL[item]}</option>)}
              </select>
            </Field>
            <Field label="Комментарий"><input className={controlClass} value={stopNote} onChange={(event) => setStopNote(event.target.value)} /></Field>
            <Button type="submit" variant="danger">Остановить</Button>
          </form>
        ) : null}
      </section>

      <Profile driverId={driver.id} editable={editable} onError={setError} />

      <section className="crm-panel p-4">
        <h3 className="font-semibold">Документы</h3>
        <p className="mt-1 text-xs text-[#98a2b3]">Сканы в браузере не хранятся. Отмечается только статус проверки.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DOC_KINDS.map((kind) => (
            <label key={kind} className="text-sm">
              <span className="text-[#667085]">{DOC_LABEL[kind]}</span>
              <select className={`${controlClass} mt-1`} disabled={!editable} value={driver.docs[kind]} onChange={(event) => run(crm.setDriverDoc(driver.id, kind, event.target.value as DocStatus))}>
                {(Object.keys(DOC_STATUS_LABEL) as DocStatus[]).map((item) => <option key={item} value={item}>{DOC_STATUS_LABEL[item]}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="crm-panel p-4">
        <h3 className="font-semibold">Этапы</h3>
        <ol className="mt-2 space-y-1 text-sm">
          {driver.stageLog.map((item, index) => (
            <li key={`${item.at}-${index}`}>{formatDateTime(item.at)} · {STAGE_LABEL[item.stage]}</li>
          ))}
        </ol>
      </section>

      <section className="crm-panel p-4">
        <h3 className="font-semibold">Akjol Drive и деньги</h3>
        <p className="mt-2 text-sm text-[#667085]">Приложение Akjol Drive не подключено. Баланса, выводов на банки и комиссии парка оттуда нет.</p>
        <p className="mt-1 text-sm">Сумма выполненных заказов в этой CRM: {turnover ? `${turnover} сом` : "0 сом — цен в заказах нет"}.</p>
      </section>

      <section className="crm-panel">
        <h3 className="px-4 py-3 font-semibold">Заказы водителя</h3>
        {orders.length === 0 ? <p className="px-4 pb-4 text-sm text-[#667085]">Заказов нет</p> : orders.map((order) => (
          <p key={order.id} className="border-t border-[#e6e8ec] px-4 py-2 text-sm">№{order.number} · {order.pickup} → {order.dropoff} · {order.price ?? "без суммы"} · {ORDER_STATUS_LABEL[order.status]}</p>
        ))}
      </section>

      <section className="crm-panel p-4">
        <h3 className="font-semibold">Заметки</h3>
        {editable ? (
          <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); const result = crm.addDriverNote(driver.id, note); run(result); if (result.ok) setNote(""); }}>
            <input className={controlClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Возражение, УТП, договорённость" />
            <Button type="submit">Добавить</Button>
          </form>
        ) : null}
        {notes.length === 0 ? <p className="mt-2 text-sm text-[#667085]">Заметок нет</p> : notes.map((item) => {
          const author = crm.state.users.find((person) => person.id === item.authorId);
          return <p key={item.id} className="mt-2 text-sm">{item.text}<span className="mt-0.5 block text-xs text-[#98a2b3]">{author ? fullName(author) : "сотрудник"} · {formatDateTime(item.at)}</span></p>;
        })}
      </section>

      <section className="crm-panel p-4">
        <h3 className="font-semibold">Напоминание</h3>
        {editable ? (
          <form className="mt-2 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); const result = crm.addDriverTask(driver.id, task, due ? new Date(`${due}:00+06:00`).toISOString() : "", "high"); run(result); if (result.ok) setTask(""); }}>
            <input className={`${controlClass} max-w-sm`} value={task} onChange={(event) => setTask(event.target.value)} placeholder="Перезвонить, нет ВУ" />
            <input className={`${controlClass} w-auto`} type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} />
            <Button type="submit">Поставить</Button>
          </form>
        ) : null}
      </section>

      {crm.isAdmin ? (
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Оценка диспетчера</h3>
          <p className="mt-1 text-xs text-[#98a2b3]">Кнопка рассылки не отправляет WhatsApp или SMS.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select className={`${controlClass} w-auto`} value={score} onChange={(event) => setScore(event.target.value)}>
              {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Button variant="secondary" disabled={!driver.ownerId} onClick={() => driver.ownerId && run(crm.recordRating(driver.id, driver.ownerId, Number(score)))}>Записать вручную</Button>
            <Button variant="secondary" onClick={() => setError("Оценка не отправлена: WhatsApp и SMS не подключены")}>Запросить у водителя</Button>
          </div>
          {allows(user.role, "drivers.delete") ? <Button className="mt-4" variant="danger" onClick={() => setConfirmDelete(true)}>Удалить водителя</Button> : null}
        </section>
      ) : null}

      {confirmDelete ? (
        <Modal title="Удалить водителя?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-[#52606d]">Диспетчер это действие выполнить не может. Открытый заказ удаление блокирует.</p>
          <input className={`${controlClass} mt-3`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Причина" />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>Отмена</Button>
            <Button type="button" variant="danger" onClick={() => { const result = crm.deleteDriver(driver.id, reason); if (!result.ok) { setError(result.error); setConfirmDelete(false); return; } router.push("/drivers"); }}>Удалить</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Profile({ driverId, editable, onError }: { driverId: string; editable: boolean; onError: (text: string) => void }) {
  const crm = useCrm();
  const driver = crm.state.drivers.find((item) => item.id === driverId);
  const [draft, setDraft] = useState(driver ? {
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
  } : null);
  if (!driver || !draft) return null;
  return (
    <form className="crm-panel grid gap-3 p-4 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const result = crm.saveDriverProfile(driver.id, {
        ...draft,
        carYear: draft.carYear ? Number(draft.carYear) : null,
      });
      onError(result.ok ? "" : result.error);
    }}>
      <h3 className="font-semibold sm:col-span-2">Анкета и автомобиль</h3>
      {([
        ["firstName", "Имя"],
        ["lastName", "Фамилия"],
        ["phone", "Телефон"],
        ["city", "Город"],
        ["address", "Адрес"],
        ["citizenship", "Гражданство"],
        ["inn", "ИНН"],
        ["licenseNumber", "Номер ВУ"],
        ["carModel", "Марка и модель"],
        ["plate", "Госномер"],
        ["carColor", "Цвет"],
        ["carYear", "Год"],
        ["carCategory", "Категория"],
      ] as const).map(([key, label]) => (
        <label key={key} className="text-sm">
          <span className="text-[#667085]">{label}</span>
          <input className={`${controlClass} mt-1`} disabled={!editable} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" disabled={!editable} checked={draft.pitchNoted} onChange={(event) => setDraft({ ...draft, pitchNoted: event.target.checked })} />
        УТП парка донесено
      </label>
      {editable ? <Button type="submit" className="sm:col-span-2 w-fit">Сохранить анкету</Button> : null}
    </form>
  );
}
