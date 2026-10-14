"use client";

import Link from "next/link";
import { useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { currentStatus, summarizeDate } from "@/lib/attendance";
import { fullName, WORK_LABEL } from "@/lib/labels";
import { shiftSnapshot } from "@/lib/metrics";
import {
  DOC_KINDS,
  SOURCE_LEAD_LABEL,
  STAGE_LABEL,
  driversInWindow,
  hasFirstOrder,
  hoursToFirst,
  isOverdue,
  openTasks,
  recruitmentWindow,
  sourceCounts,
} from "@/lib/recruitment";
import { useCrm, type UserInput } from "@/lib/store";
import { useTelephony } from "@/lib/telephony/client";
import { addDays, bishkekDateString, formatDuration, formatTime } from "@/lib/time";
import type { AccountStatus, Driver, DriverTask, LeadSource, Role, WorkStatus } from "@/lib/types";
import { Button, ErrorText, Field, Modal, NoAccess, controlClass } from "../ui";

const SOURCE_COLOR: Record<LeadSource, string> = {
  target: "#3b82f6",
  referral: "#22c55e",
  offline: "#8b5cf6",
  partner: "#f59e0b",
  phone: "#06b6d4",
  whatsapp: "#14b8a6",
  other: "#94a3b8",
};

const TOP_COLOR = ["#22c55e", "#22c55e", "#eab308", "#f59e0b", "#f97316"];

const emptyForm: UserInput = {
  firstName: "",
  lastName: "",
  login: "",
  password: "",
  role: "dispatcher",
  accountStatus: "active",
  scheduleStart: "09:00",
};

const fieldClass = `${controlClass} !border-[#2a3b58] !bg-[#0e1728] !text-[#e8eef8]`;

export function EmployeesScreen() {
  const crm = useCrm();
  const telephony = useTelephony();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkStatus | "all">("all");
  const [shift, setShift] = useState("all");
  const [days, setDays] = useState<7 | 14 | 30>(30);
  const [form, setForm] = useState<UserInput | null>(null);
  const [error, setError] = useState("");
  if (!crm.isAdmin) return <NoAccess />;
  if (!crm.now) return <p className="text-sm text-[#667085]">Загрузка…</p>;

  const today = bishkekDateString(new Date(crm.now));
  const pool = crm.state.drivers;
  const window = days === 14
    ? { from: addDays(today, -13), to: today }
    : recruitmentWindow(days, today);
  const periodDrivers = driversInWindow(pool, window.from, window.to);
  const staff = crm.state.users.filter((user) => user.role === "dispatcher");
  const shifts = [...new Set(staff.map((user) => user.scheduleStart || "без графика"))];
  const rows = staff.map((user) => {
    const owned = periodDrivers.filter((driver) => driver.ownerId === user.id);
    const brought = owned.filter((driver) => hasFirstOrder(driver, crm.state.orders));
    const hours = brought.map((driver) => hoursToFirst(driver, crm.state.orders)).filter((value): value is number => value != null);
    let worked = 0;
    for (const day of datesOf(window.from, window.to)) {
      worked += summarizeDate(crm.state.events, user.id, day, crm.now, user.scheduleStart).workedMs;
    }
    const registeredToday = pool.filter((driver) => driver.ownerId === user.id && bishkekDateString(new Date(driver.createdAt)) === today).length;
    const active = owned.filter((driver) => driver.stage !== "stopped").length;
    return {
      user,
      status: currentStatus(crm.state.events, user.id, new Date(crm.now)),
      registered: owned.length,
      registeredToday,
      active,
      activeShare: owned.length ? Math.round((active / owned.length) * 100) : 0,
      first: brought.length,
      conversion: owned.length ? Math.round((brought.length / owned.length) * 100) : 0,
      worked,
      avgHours: hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : null,
    };
  }).sort((a, b) => b.first - a.first || b.registered - a.registered);
  const visible = rows.filter((row) => {
    const name = `${fullName(row.user)} ${row.user.login}`.toLowerCase();
    if (query.trim() && !name.includes(query.trim().toLowerCase())) return false;
    if (status !== "all" && row.status !== status) return false;
    if (shift !== "all" && (row.user.scheduleStart || "без графика") !== shift) return false;
    return true;
  });
  const top = [...rows].filter((row) => row.user.accountStatus === "active").slice(0, 5);
  const topMax = Math.max(1, ...top.map((row) => row.first));
  const sources = sourceCounts(periodDrivers);
  const sourceTotal = sources.reduce((sum, item) => sum + item.count, 0);
  const live = shiftSnapshot(crm.state, crm.now);
  const activeStaff = staff.filter((user) => user.accountStatus === "active");
  const onShiftShare = activeStaff.length ? Math.round((live.onShift / activeStaff.length) * 100) : 0;
  const callback = pool.filter((driver) => driver.stage === "application" || driver.stage === "call");
  const problematic = pool.filter((driver) => driver.stage === "stopped" || driver.stage === "srmk" || DOC_KINDS.some((kind) => driver.docs[kind] === "rejected"));
  const tasks = liveQueue(pool, openTasks(crm.state.driverTasks), crm.now);
  const recent = [...pool].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const periodLabel = days === 7 ? "7 дней" : days === 14 ? "14 дней" : "За месяц";

  function exportRows() {
    downloadCsv(`диспетчеры-${window.from}-${window.to}.csv`, [
      ["Диспетчер", "Логин", "Статус", "Зарегистрировано", "Сегодня", "Активных", "1-й заказ", "Конверсия", "Рабочее время", "До 1-го заказа"],
      ...visible.map((row) => [
        fullName(row.user),
        row.user.login,
        WORK_LABEL[row.status],
        String(row.registered),
        String(row.registeredToday),
        String(row.active),
        String(row.first),
        row.registered ? `${row.conversion}%` : "",
        formatDuration(row.worked),
        formatHours(row.avgHours),
      ]),
    ]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const result = await crm.saveUser(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForm(null);
  }

  function edit(userId: string) {
    const user = crm.state.users.find((item) => item.id === userId);
    if (!user) return;
    setError("");
    setForm({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      login: user.login,
      password: "",
      role: user.role,
      accountStatus: user.accountStatus,
      scheduleStart: user.scheduleStart,
    });
  }

  return (
    <div className="space-y-4 rounded-2xl bg-[#0b1220] p-4 text-[#e8eef8]">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-xl border border-[#1e2d48] bg-[#121a2b]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#1e2d48] px-4 py-3">
            <h2 className="mr-auto text-base font-semibold whitespace-nowrap">Эффективность диспетчеров</h2>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по имени диспетчера…" className="h-8 w-52 rounded-lg border !border-[#2a3b58] !bg-[#0e1728] px-3 text-sm !text-[#e8eef8] outline-none placeholder:text-[#7d8eab]" />
            <select value={status} onChange={(event) => setStatus(event.target.value as WorkStatus | "all")} className="h-8 rounded-lg border !border-[#2a3b58] !bg-[#0e1728] px-2 text-sm !text-[#e8eef8]">
              <option value="all">Все статусы</option>
              <option value="working">На месте</option>
              <option value="away">Отошёл</option>
              <option value="idle">Не на смене</option>
              <option value="finished">Закончил</option>
            </select>
            <select value={shift} onChange={(event) => setShift(event.target.value)} className="h-8 rounded-lg border !border-[#2a3b58] !bg-[#0e1728] px-2 text-sm !text-[#e8eef8]">
              <option value="all">Все смены</option>
              {shifts.map((item) => <option key={item} value={item}>{item === "без графика" ? item : `Смена ${item}`}</option>)}
            </select>
            <button type="button" onClick={exportRows} className="h-8 rounded-lg border border-[#2a3b58] px-3 text-xs text-[#d5deee] hover:bg-[#1a2740]">Экспорт</button>
            <button type="button" onClick={() => { setError(""); setForm({ ...emptyForm }); }} className="h-8 rounded-lg bg-[#2563eb] px-3 text-xs font-medium text-white hover:bg-[#1d4ed8]">Добавить</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs text-[#8ea0bd]">
                <tr>
                  {["#", "Диспетчер", "Статус", "Зарег. водителей", "Активных", "1-й заказ", "Конверсия", "Раб. время", "Среднее время до 1-го заказа"].map((title) => (
                    <th key={title} className="px-3 py-2 font-medium">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-[#8ea0bd]">Нет диспетчеров по этому фильтру</td></tr>
                ) : visible.map((row, index) => (
                  <tr key={row.user.id} className="border-t border-[#1e2d48]">
                    <td className="px-3 py-3 tabular-nums text-[#8ea0bd]">{index + 1}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <Avatar name={fullName(row.user)} id={row.user.id} />
                        <span>
                          <Link href={`/profile?user=${row.user.id}`} className="font-medium whitespace-nowrap hover:text-white">{shortName(row.user.firstName, row.user.lastName)}</Link>
                          <span className="block text-xs text-[#8ea0bd]">{row.user.login}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3"><StatusPill status={row.status} blocked={row.user.accountStatus === "blocked"} /></td>
                    <td className="px-3 py-3">
                      <span className="block text-base font-semibold tabular-nums">{row.registered}</span>
                      <span className={`text-xs ${row.registeredToday ? "text-[#3ddc97]" : "text-[#8ea0bd]"}`}>{row.registeredToday ? `+${row.registeredToday} сегодня` : "сегодня 0"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold tabular-nums">{row.active}</span>
                      <span className="text-xs text-[#8ea0bd]">{row.registered ? `${row.activeShare}%` : "—"}</span>
                    </td>
                    <td className="px-3 py-3 text-base font-semibold tabular-nums">{row.first}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#243248]">
                          <span className="block h-full rounded-full" style={{ width: `${row.conversion}%`, background: conversionColor(row.conversion) }} />
                        </span>
                        <span className="tabular-nums">{row.registered ? `${row.conversion}%` : "—"}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatDuration(row.worked)}</td>
                    <td className="px-3 py-3">
                      <span className="tabular-nums">{formatHours(row.avgHours)}</span>
                      <button type="button" className="ml-3 text-xs text-[#7dd3fc]" onClick={() => edit(row.user.id)}>Изменить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-[#1e2d48] bg-[#121a2b] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Топ-диспетчеры</h2>
              <select value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 14 | 30)} className="h-8 rounded-lg border !border-[#2a3b58] !bg-[#0e1728] px-2 text-xs !text-[#e8eef8]">
                <option value={7}>7 дней</option>
                <option value={14}>14 дней</option>
                <option value={30}>За месяц</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-[#8ea0bd]">по 1-м заказам · {periodLabel.toLowerCase()}</p>
            {top.length === 0 ? <p className="mt-3 text-sm text-[#8ea0bd]">Диспетчеров нет</p> : (
              <ol className="mt-3 space-y-3">
                {top.map((row, index) => (
                  <li key={row.user.id} className="grid grid-cols-[18px_28px_minmax(0,1fr)_28px] items-center gap-2 text-sm">
                    <span className="text-xs text-[#8ea0bd]">{index + 1}</span>
                    <Avatar name={fullName(row.user)} id={row.user.id} />
                    <span className="min-w-0">
                      <span className="block truncate">{shortName(row.user.firstName, row.user.lastName)}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#243248]">
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(row.first ? 8 : 0, (row.first / topMax) * 100)}%`, background: TOP_COLOR[index] ?? "#22c55e" }} />
                      </span>
                    </span>
                    <span className="text-right font-semibold tabular-nums">{row.first}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-xl border border-[#1e2d48] bg-[#121a2b] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Источники заявок</h2>
              <span className="text-xs text-[#8ea0bd]">{periodLabel}</span>
            </div>
            {sourceTotal === 0 ? <p className="mt-3 text-sm text-[#8ea0bd]">В этом периоде заявок нет</p> : (
              <div className="mt-3 flex items-center gap-3">
                <Donut total={sourceTotal} slices={sources.map((item) => ({ value: item.count, color: SOURCE_COLOR[item.source] }))} />
                <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                  {sources.map((item) => (
                    <li key={item.source} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SOURCE_COLOR[item.source] }} />
                      <span className="min-w-0 flex-1 truncate text-[#d5deee]">{SOURCE_LEAD_LABEL[item.source]}</span>
                      <span className="tabular-nums text-[#8ea0bd]">{Math.round((item.count / sourceTotal) * 100)}%</span>
                      <span className="w-6 text-right tabular-nums">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <section className="rounded-xl border border-[#1e2d48] bg-[#121a2b] p-4">
          <h2 className="font-semibold">Текущая ситуация</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Situation tone="green" label="Работают сейчас" value={`${live.onShift} / ${activeStaff.length}`} hint={activeStaff.length ? `${onShiftShare}% на месте` : "Диспетчеров нет"} href="/time" />
            <Situation tone="blue" label="В активных звонках" value={String(telephony.status.active.length)} hint={telephony.status.connected ? `очередь ${telephony.status.queueCount}` : "Телефония не подключена"} href="/telephony" />
            <Situation tone="amber" label="Требуют внимания" value={String(callback.length)} hint={callback.length ? "Нужно перезвонить" : "Новых заявок нет"} href="/drivers" />
            <Situation tone="rose" label="Проблемные" value={String(problematic.length)} hint={problematic.length ? "Документы / СРМК" : "Таких заявок нет"} href="/drivers" />
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-[#1e2d48] bg-[#121a2b]">
          <div className="flex items-center justify-between border-b border-[#1e2d48] px-4 py-3">
            <h2 className="font-semibold">Последние регистрации</h2>
            <Link href="/drivers" className="text-xs text-[#7dd3fc]">Все</Link>
          </div>
          {recent.length === 0 ? <p className="px-4 py-4 text-sm text-[#8ea0bd]">Заявок нет</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs text-[#8ea0bd]">
                  <tr>{["Время", "Водитель", "Диспетчер", "Этап", "Статус"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
                </thead>
                <tbody>
                  {recent.map((driver) => {
                    const owner = crm.state.users.find((user) => user.id === driver.ownerId);
                    return (
                      <tr key={driver.id} className="border-t border-[#1e2d48]">
                        <td className="px-3 py-2 text-xs text-[#8ea0bd]">{formatTime(driver.createdAt)}</td>
                        <td className="px-3 py-2"><Link href="/drivers" className="hover:text-white">{fullName(driver)}</Link></td>
                        <td className="px-3 py-2 text-[#d5deee]">{owner ? shortName(owner.firstName, owner.lastName) : "—"}</td>
                        <td className="px-3 py-2 text-[#d5deee]">{STAGE_LABEL[driver.stage]}</td>
                        <td className="px-3 py-2"><StageMark stage={driver.stage} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#1e2d48] bg-[#121a2b]">
          <div className="flex items-center justify-between border-b border-[#1e2d48] px-4 py-3">
            <h2 className="font-semibold">Задачи и уведомления</h2>
            <span className="rounded-full bg-[#243248] px-2 py-0.5 text-xs tabular-nums text-[#d5deee]">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? <p className="px-4 py-4 text-sm text-[#8ea0bd]">Открытых задач нет</p> : (
            <ul>
              {tasks.slice(0, 6).map((task) => (
                <li key={task.id} className="flex items-start gap-2 border-t border-[#1e2d48] px-4 py-2.5 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${task.tone === "rose" ? "bg-[#f43f5e]" : task.tone === "amber" ? "bg-[#f59e0b]" : "bg-[#22c55e]"}`} />
                  <span className="min-w-0">
                    <span className="block truncate">{task.title}</span>
                    <span className="block text-xs text-[#8ea0bd]">{formatTime(task.at)} · {task.meta}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {form ? (
        <Modal title={form.id ? "Редактировать диспетчера" : "Новый диспетчер"} onClose={() => setForm(null)}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <Field label="Имя"><input className={fieldClass} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></Field>
            <Field label="Фамилия"><input className={fieldClass} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></Field>
            <Field label="Логин"><input className={fieldClass} value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} required /></Field>
            <Field label={form.id ? "Новый пароль" : "Пароль"}><input className={fieldClass} type="password" value={form.password ?? ""} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={form.id ? "Пусто — пароль не меняется" : ""} /></Field>
            <Field label="Роль">
              <select className={fieldClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                <option value="dispatcher">Диспетчер</option>
                <option value="admin">Администратор</option>
              </select>
            </Field>
            <Field label="Статус аккаунта">
              <select className={fieldClass} value={form.accountStatus} onChange={(event) => setForm({ ...form, accountStatus: event.target.value as AccountStatus })}>
                <option value="active">Активен</option>
                <option value="blocked">Заблокирован</option>
              </select>
            </Field>
            <Field label="Начало смены">
              <input className={fieldClass} type="time" value={form.scheduleStart ?? ""} onChange={(event) => setForm({ ...form, scheduleStart: event.target.value || null })} />
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <ErrorText>{error}</ErrorText>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

type QueueItem = { id: string; title: string; at: string; meta: string; tone: "green" | "amber" | "rose" };

function liveQueue(drivers: Driver[], tasks: DriverTask[], now: number): QueueItem[] {
  const fromTasks: QueueItem[] = tasks.map((task) => {
    const driver = drivers.find((item) => item.id === task.driverId);
    return {
      id: task.id,
      title: task.title,
      at: task.dueAt,
      meta: driver ? fullName(driver) : "Водитель",
      tone: isOverdue(task, now) || task.priority === "high" ? "rose" : "green",
    };
  });
  const covered = new Set(tasks.map((task) => task.driverId));
  const derived: QueueItem[] = drivers.filter((driver) => !covered.has(driver.id)).flatMap((driver): QueueItem[] => {
    if (driver.stage === "application" || driver.stage === "call") {
      return [{ id: `call-${driver.id}`, title: `Перезвонить: ${fullName(driver)}`, at: driver.createdAt, meta: STAGE_LABEL[driver.stage], tone: "amber" as const }];
    }
    if (driver.stage === "documents" || driver.stage === "srmk" || DOC_KINDS.some((kind) => driver.docs[kind] === "rejected")) {
      return [{ id: `doc-${driver.id}`, title: `Проверить документы: ${fullName(driver)}`, at: driver.createdAt, meta: STAGE_LABEL[driver.stage], tone: "amber" as const }];
    }
    if (driver.stage === "stopped") {
      return [{ id: `stop-${driver.id}`, title: `Остановлен: ${fullName(driver)}`, at: driver.createdAt, meta: "Документы / СРМК", tone: "rose" as const }];
    }
    return [];
  });
  return [...fromTasks, ...derived].sort((a, b) => b.at.localeCompare(a.at));
}

function datesOf(from: string, to: string) {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < 40) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function formatHours(hours: number | null) {
  if (hours == null) return "нет данных";
  const total = Math.round(hours * 60);
  const whole = Math.floor(total / 60);
  const minutes = total % 60;
  if (!whole) return `${minutes} мин`;
  return `${whole} ч ${minutes} мин`;
}

function shortName(first: string, last: string) {
  return `${last} ${first.slice(0, 1)}.`;
}

function conversionColor(value: number) {
  if (value >= 70) return "#22c55e";
  if (value >= 40) return "#eab308";
  return "#f43f5e";
}

function StatusPill({ status, blocked }: { status: WorkStatus; blocked: boolean }) {
  if (blocked) return <span className="rounded-full bg-[#3b1d2a] px-2 py-0.5 text-xs text-[#fda4af]">Заблокирован</span>;
  const label = status === "working" ? "На месте" : status === "away" ? "Отошёл" : WORK_LABEL[status];
  const tone = status === "working"
    ? "bg-[#123d32] text-[#3ddc97]"
    : status === "away"
      ? "bg-[#3d3014] text-[#f5c16c]"
      : "bg-[#243248] text-[#8ea0bd]";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

function StageMark({ stage }: { stage: Driver["stage"] }) {
  const label = stage === "first_order" ? "Сделан" : stage === "stopped" ? "Остановлен" : stage === "application" || stage === "call" ? "Новая" : "В процессе";
  const color = stage === "first_order" ? "#22c55e" : stage === "stopped" ? "#f43f5e" : "#3b82f6";
  return <span className="inline-flex items-center gap-1 text-xs" style={{ color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</span>;
}

function Avatar({ name, id }: { name: string; id: string }) {
  const colors = ["#2563eb", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#0369a1"];
  let hash = 0;
  for (const char of id) hash += char.charCodeAt(0);
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs text-white" style={{ background: colors[hash % colors.length] }}>{name.trim().slice(0, 1).toUpperCase()}</span>;
}

function Donut({ total, slices }: { total: number; slices: { value: number; color: string }[] }) {
  const radius = 42;
  const length = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={`${total} заявок по источникам`}>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#243248" strokeWidth="14" />
      {slices.map((slice, index) => {
        const dash = (slice.value / total) * length;
        const node = (
          <circle key={index} cx="60" cy="60" r={radius} fill="none" stroke={slice.color} strokeWidth="14" strokeDasharray={`${dash} ${length - dash}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
        );
        offset += dash;
        return node;
      })}
      <text x="60" y="58" textAnchor="middle" fill="#e8eef8" fontSize="18" fontWeight="600">{total}</text>
      <text x="60" y="74" textAnchor="middle" fill="#8ea0bd" fontSize="10">заявки</text>
    </svg>
  );
}

function Situation({ tone, label, value, hint, href }: { tone: "green" | "blue" | "amber" | "rose"; label: string; value: string; hint: string; href: string }) {
  const palette = {
    green: "border-[#14532d] bg-[#10281c] text-[#3ddc97]",
    blue: "border-[#1e3a8a] bg-[#101c33] text-[#7dd3fc]",
    amber: "border-[#78350f] bg-[#2a2112] text-[#f5c16c]",
    rose: "border-[#7f1d1d] bg-[#2a1418] text-[#fda4af]",
  }[tone];
  return (
    <Link href={href} className={`rounded-lg border px-3 py-2 ${palette}`}>
      <p className="text-xs text-[#d5deee]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs opacity-80">{hint}</p>
    </Link>
  );
}
