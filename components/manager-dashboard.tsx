"use client";

import Link from "next/link";
import { useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { currentStatus, summarizeDate } from "@/lib/attendance";
import { fullName, WORK_LABEL } from "@/lib/labels";
import { shiftSnapshot } from "@/lib/metrics";
import {
  DOC_KINDS,
  PIPELINE,
  SOURCE_LEAD_LABEL,
  STAGE_LABEL,
  countReached,
  dailySeries,
  driversInWindow,
  hasFirstOrder,
  hoursToFirst,
  isOverdue,
  lossPercent,
  openTasks,
  recruitmentWindow,
  sourceCounts,
} from "@/lib/recruitment";
import { useCrm } from "@/lib/store";
import { useTelephony } from "@/lib/telephony/client";
import { addDays, bishkekDateString, formatClock, formatDuration, formatTime } from "@/lib/time";
import type { Driver, DriverTask, LeadSource, RecruitStage, WorkStatus } from "@/lib/types";

const SOURCE_COLOR: Record<LeadSource, string> = {
  target: "#2563eb",
  referral: "#12a878",
  offline: "#7c3aed",
  partner: "#d97706",
  phone: "#0891b2",
  whatsapp: "#16a34a",
  other: "#94a3b8",
};

const PERIODS = [
  { days: 7 as const, label: "7 дней" },
  { days: 14 as const, label: "14 дней" },
  { days: 30 as const, label: "Месяц" },
];

export function ManagerDashboard() {
  const crm = useCrm();
  const telephony = useTelephony();
  const [days, setDays] = useState<(typeof PERIODS)[number]["days"]>(30);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkStatus | "all">("all");
  if (!crm.now) return <p className="text-sm text-[#667085]">Загрузка…</p>;

  const today = bishkekDateString(new Date(crm.now));
  const pool = crm.state.drivers;
  const demoCount = pool.filter((driver) => driver.demo).length;
  const window = days === 14
    ? { from: addDays(today, -13), to: today, prevFrom: addDays(today, -27), prevTo: addDays(today, -14) }
    : recruitmentWindow(days, today);
  const periodDrivers = driversInWindow(pool, window.from, window.to);
  const chartFrom = addDays(today, -13);
  const series = dailySeries(pool, crm.state.orders, chartFrom, today);
  const registered = pool.length;
  const registeredToday = pool.filter((driver) => bishkekDateString(new Date(driver.createdAt)) === today).length;
  const active = pool.filter((driver) => isActive(driver)).length;
  const first = pool.filter((driver) => hasFirstOrder(driver, crm.state.orders)).length;
  const lost = registered - first;
  const steps = PIPELINE.map((stage, index) => {
    const count = countReached(pool, crm.state.orders, stage);
    const prev = index === 0 ? count : countReached(pool, crm.state.orders, PIPELINE[index - 1]);
    return {
      stage,
      count,
      loss: index === 0 ? null : lossPercent(prev, count),
      share: registered ? Math.round((count / registered) * 100) : 0,
    };
  });
  const staff = crm.state.users.filter((user) => user.role === "dispatcher" && user.accountStatus === "active");
  const rows = staff.map((user) => {
    const owned = periodDrivers.filter((driver) => driver.ownerId === user.id);
    const brought = owned.filter((driver) => hasFirstOrder(driver, crm.state.orders));
    const hours = brought.map((driver) => hoursToFirst(driver, crm.state.orders)).filter((value): value is number => value != null);
    let worked = 0;
    for (const day of datesOf(window.from, window.to)) {
      worked += summarizeDate(crm.state.events, user.id, day, crm.now, user.scheduleStart).workedMs;
    }
    return {
      user,
      status: currentStatus(crm.state.events, user.id, new Date(crm.now)),
      registered: owned.length,
      active: owned.filter((driver) => isActive(driver)).length,
      first: brought.length,
      conversion: owned.length ? Math.round((brought.length / owned.length) * 100) : 0,
      worked,
      avgHours: hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : null,
    };
  }).sort((a, b) => b.first - a.first || b.registered - a.registered);
  const visibleRows = rows.filter((row) => {
    const name = fullName(row.user).toLowerCase();
    if (query.trim() && !name.includes(query.trim().toLowerCase())) return false;
    if (status !== "all" && row.status !== status) return false;
    return true;
  });
  const top = [...rows].sort((a, b) => b.first - a.first).slice(0, 5);
  const topMax = Math.max(1, ...top.map((row) => row.first));
  const sources = sourceCounts(periodDrivers);
  const sourceTotal = sources.reduce((sum, item) => sum + item.count, 0);
  const shifts = shiftSnapshot(crm.state, crm.now);
  const onShiftShare = staff.length ? Math.round((shifts.onShift / staff.length) * 100) : 0;
  const callback = pool.filter((driver) => driver.stage === "application" || driver.stage === "call");
  const problematic = pool.filter((driver) => isProblem(driver));
  const tasks = liveQueue(pool, openTasks(crm.state.driverTasks), crm.now);
  const recent = [...pool].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const periodLabel = PERIODS.find((item) => item.days === days)?.label ?? "Месяц";
  const sparkRegistered = series.map((item) => item.registered);
  const sparkFirst = series.map((item) => item.first);
  const sparkActive = series.map((item) => item.registered);
  const sparkLost = series.map((item) => Math.max(0, item.registered - item.first));

  function exportRows() {
    downloadCsv(`диспетчеры-${window.from}-${window.to}.csv`, [
      ["Диспетчер", "Статус", "Зарегистрировано", "Активных", "1-й заказ", "Конверсия", "Рабочее время", "До 1-го заказа"],
      ...visibleRows.map((row) => [
        fullName(row.user),
        WORK_LABEL[row.status],
        String(row.registered),
        String(row.active),
        String(row.first),
        row.registered ? `${row.conversion}%` : "",
        formatDuration(row.worked),
        formatHours(row.avgHours),
      ]),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Панель руководителя</h2>
          <p className="mt-1 max-w-3xl text-sm text-[#667085]">
            Общая ситуация по регистрации водителей, работе диспетчеров и конверсии в первый заказ.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-[#667085]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#12a878]" />
          Живая статистика · {formatClock(new Date(crm.now))} · Бишкек
        </p>
      </div>

      {demoCount > 0 ? (
        <p className="rounded-lg border border-[#f5e3b8] bg-[#fffaf0] px-3 py-2 text-sm text-[#92400e]">
          В расчёте демо-заявок: {demoCount}. Они стоят в том же списке, что и реальные карточки. Новая заявка сразу меняет эти цифры.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi tone="green" label="Зарегистрировано водителей" value={registered} hint={registeredToday ? `+${registeredToday} сегодня` : "Сегодня новых нет"} bars={sparkRegistered} />
        <Kpi tone="blue" label="Активных водителей" value={active} hint={share(active, registered, "от зарегистрированных")} bars={sparkActive} />
        <Kpi tone="violet" label="Совершили 1-й заказ" value={first} hint={share(first, registered, "от зарегистрированных")} bars={sparkFirst} />
        <Kpi tone="rose" label="Не дошли до 1-го заказа" value={lost} hint={share(lost, registered, "от зарегистрированных")} bars={sparkLost} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Конверсия по этапам</h3>
          <Funnel steps={steps} />
        </section>
        <section className="crm-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Регистрации и 1-й заказ</h3>
            <span className="text-xs text-[#98a2b3]">14 дней</span>
          </div>
          <BarChart series={series} />
        </section>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="crm-panel min-w-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#e6e8ec] px-4 py-3">
            <h3 className="mr-auto font-semibold">Эффективность диспетчеров</h3>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по имени"
              className="h-8 w-40 rounded-lg border border-[#e6e8ec] bg-[#f7f8fa] px-2 text-sm outline-none focus:border-[#2e6db4]"
            />
            <select value={status} onChange={(event) => setStatus(event.target.value as WorkStatus | "all")} className="h-8 rounded-lg border border-[#e6e8ec] bg-white px-2 text-sm">
              <option value="all">Все статусы</option>
              <option value="working">На месте</option>
              <option value="away">Отошёл</option>
              <option value="idle">Не на смене</option>
              <option value="finished">Закончил</option>
            </select>
            <div className="flex rounded-lg border border-[#e6e8ec] bg-white p-0.5">
              {PERIODS.map((item) => (
                <button key={item.days} type="button" onClick={() => setDays(item.days)} className={`rounded-md px-2 py-1 text-xs ${days === item.days ? "bg-[#e8f1fb] font-medium text-[#1d5fa7]" : "text-[#667085]"}`}>{item.label}</button>
              ))}
            </div>
            <button type="button" onClick={exportRows} className="h-8 rounded-lg border border-[#e6e8ec] bg-white px-2 text-xs hover:bg-[#f4f6f8]">Экспорт</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs text-[#667085]">
                <tr>
                  {["#", "Диспетчер", "Статус", "Зарег.", "Активных", "1-й заказ", "Конверсия", "Раб. время", "До 1-го заказа"].map((title) => (
                    <th key={title} className="px-3 py-2 font-medium">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-6 text-[#667085]">Нет диспетчеров по этому фильтру</td></tr>
                ) : visibleRows.map((row, index) => (
                  <tr key={row.user.id} className="border-t border-[#e6e8ec]">
                    <td className="px-3 py-2 tabular-nums text-[#98a2b3]">{index + 1}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Avatar name={fullName(row.user)} id={row.user.id} />
                        <span>
                          <span className="block font-medium">{fullName(row.user)}</span>
                          <span className="block text-xs text-[#98a2b3]">{row.user.login}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2"><StatusPill status={row.status} /></td>
                    <td className="px-3 py-2 tabular-nums">{row.registered}</td>
                    <td className="px-3 py-2 tabular-nums">{row.active}</td>
                    <td className="px-3 py-2 tabular-nums">{row.first}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#eef1f4]">
                          <span className="block h-full rounded-full" style={{ width: `${row.conversion}%`, background: conversionColor(row.conversion) }} />
                        </span>
                        <span className="tabular-nums">{row.registered ? `${row.conversion}%` : "—"}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatDuration(row.worked)}</td>
                    <td className="px-3 py-2">{formatHours(row.avgHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[#e6e8ec] px-4 py-2 text-xs text-[#98a2b3]">Заявки и конверсия — за {periodLabel.toLowerCase()}. Статус и «на месте» берутся из текущей смены.</p>
        </section>

        <div className="space-y-4">
          <section className="crm-panel p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Топ-диспетчеры</h3>
              <span className="text-xs text-[#98a2b3]">по 1-м заказам · {periodLabel.toLowerCase()}</span>
            </div>
            {top.length === 0 ? <p className="mt-3 text-sm text-[#667085]">Диспетчеров нет</p> : (
              <ol className="mt-3 space-y-2">
                {top.map((row, index) => (
                  <li key={row.user.id} className="grid grid-cols-[20px_1fr_auto] items-center gap-2 text-sm">
                    <span className="text-xs text-[#98a2b3]">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate">{shortName(row.user.firstName, row.user.lastName)}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#eef1f4]">
                        <span className="block h-full rounded-full bg-[#12a878]" style={{ width: `${(row.first / topMax) * 100}%` }} />
                      </span>
                    </span>
                    <span className="tabular-nums font-medium">{row.first}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="crm-panel p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Источники заявок</h3>
              <span className="text-xs text-[#98a2b3]">{periodLabel}</span>
            </div>
            {sourceTotal === 0 ? <p className="mt-3 text-sm text-[#667085]">В этом периоде заявок нет</p> : (
              <div className="mt-3 flex items-center gap-4">
                <Donut total={sourceTotal} slices={sources.map((item) => ({ value: item.count, color: SOURCE_COLOR[item.source] }))} />
                <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                  {sources.map((item) => (
                    <li key={item.source} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SOURCE_COLOR[item.source] }} />
                      <span className="min-w-0 flex-1 truncate">{SOURCE_LEAD_LABEL[item.source]}</span>
                      <span className="tabular-nums text-[#667085]">{Math.round((item.count / sourceTotal) * 100)}%</span>
                      <span className="w-8 text-right tabular-nums">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Текущая ситуация</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Situation tone="green" label="На смене сейчас" value={`${shifts.onShift} / ${staff.length}`} hint={staff.length ? `${onShiftShare}% на месте` : "Диспетчеров нет"} href="/time" />
            <Situation tone="blue" label="В активных звонках" value={String(telephony.status.active.length)} hint={telephony.status.connected ? `Очередь: ${telephony.status.queueCount}` : "Телефония не подключена"} href="/telephony" />
            <Situation tone="amber" label="Требуют внимания" value={String(callback.length)} hint={callback.length ? "Нужно перезвонить" : "Новых заявок нет"} href="/drivers" />
            <Situation tone="rose" label="Проблемные" value={String(problematic.length)} hint={problematic.length ? "Документы / СРМК / остановлены" : "Таких заявок нет"} href="/drivers" />
          </div>
        </section>

        <section className="crm-panel min-w-0">
          <div className="flex items-center justify-between border-b border-[#e6e8ec] px-4 py-3">
            <h3 className="font-semibold">Последние регистрации</h3>
            <Link href="/drivers" className="text-xs text-[#1d5fa7]">Все</Link>
          </div>
          {recent.length === 0 ? <p className="px-4 py-4 text-sm text-[#667085]">Заявок нет</p> : (
            <ul>
              {recent.map((driver) => {
                const owner = crm.state.users.find((user) => user.id === driver.ownerId);
                return (
                  <li key={driver.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 border-t border-[#e6e8ec] px-4 py-2 text-sm">
                    <span className="text-xs text-[#98a2b3]">{formatTime(driver.createdAt)}</span>
                    <span className="min-w-0">
                      <Link href="/drivers" className="block truncate font-medium hover:text-[#1d5fa7]">{fullName(driver)}</Link>
                      <span className="block truncate text-xs text-[#667085]">{owner ? shortName(owner.firstName, owner.lastName) : "Без диспетчера"} · {STAGE_LABEL[driver.stage]}</span>
                    </span>
                    <StageBadge stage={driver.stage} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="crm-panel min-w-0">
          <div className="flex items-center justify-between border-b border-[#e6e8ec] px-4 py-3">
            <h3 className="font-semibold">Задачи и уведомления</h3>
            <Link href="/drivers" className="text-xs text-[#1d5fa7]">Все</Link>
          </div>
          {tasks.length === 0 ? <p className="px-4 py-4 text-sm text-[#667085]">Открытых задач по водителям нет</p> : (
            <ul>
              {tasks.slice(0, 6).map((task) => (
                <li key={task.id} className="flex items-start gap-2 border-t border-[#e6e8ec] px-4 py-2 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${task.tone === "rose" ? "bg-[#d1435b]" : task.tone === "amber" ? "bg-[#d97706]" : "bg-[#2563eb]"}`} />
                  <span className="min-w-0">
                    <span className="block truncate">{task.title}</span>
                    <span className="block text-xs text-[#98a2b3]">{formatTime(task.at)} · {task.meta}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function isActive(driver: Driver) {
  return driver.stage !== "stopped";
}

function isProblem(driver: Driver) {
  if (driver.stage === "stopped" || driver.stage === "srmk") return true;
  return DOC_KINDS.some((kind) => driver.docs[kind] === "rejected");
}

type QueueItem = { id: string; title: string; at: string; meta: string; tone: "blue" | "amber" | "rose" };

function queueItem(id: string, title: string, at: string, meta: string, tone: QueueItem["tone"]): QueueItem {
  return { id, title, at, meta, tone };
}

function liveQueue(drivers: Driver[], tasks: DriverTask[], now: number) {
  const fromTasks = tasks.map((task) => {
    const driver = drivers.find((item) => item.id === task.driverId);
    return queueItem(task.id, task.title, task.dueAt, driver ? fullName(driver) : "Водитель", isOverdue(task, now) || task.priority === "high" ? "rose" : "blue");
  });
  const covered = new Set(tasks.map((task) => task.driverId));
  const derived = drivers.filter((driver) => !covered.has(driver.id)).flatMap((driver): QueueItem[] => {
    if (driver.stage === "application" || driver.stage === "call") {
      return [queueItem(`call-${driver.id}`, `Перезвонить: ${fullName(driver)}`, driver.createdAt, STAGE_LABEL[driver.stage], "blue")];
    }
    if (driver.stage === "documents" || driver.stage === "srmk" || DOC_KINDS.some((kind) => driver.docs[kind] === "rejected")) {
      return [queueItem(`doc-${driver.id}`, `Проверить документы: ${fullName(driver)}`, driver.createdAt, STAGE_LABEL[driver.stage], "amber")];
    }
    if (driver.stage === "stopped") {
      return [queueItem(`stop-${driver.id}`, `Остановлен: ${fullName(driver)}`, driver.createdAt, driver.stopReason ? "Нужна причина в карточке" : STAGE_LABEL.stopped, "rose")];
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

function share(part: number, total: number, tail: string) {
  if (!total) return "Нет заявок";
  return `${Math.round((part / total) * 100)}% ${tail}`;
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
  if (value >= 70) return "#12a878";
  if (value >= 40) return "#d97706";
  return "#d1435b";
}

const FUNNEL_COLORS = ["#2f7bff", "#2a62d4", "#1e4ea8", "#163e84", "#14506e", "#0f7a4e"];

function Funnel({ steps }: { steps: { stage: RecruitStage; count: number; loss: number | null }[] }) {
  const base = steps[0]?.count ?? 0;
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="flex min-w-[760px]">
        {steps.map((step, index) => {
          const percent = base ? Math.round((step.count / base) * 100) : 0;
          const drop = index > 0 && step.loss != null && step.loss > 0;
          return (
            <div key={step.stage} className="relative min-w-0 flex-1" style={{ marginLeft: index === 0 ? 0 : -18, zIndex: index + 1 }}>
              <div
                className="flex h-[92px] flex-col justify-center text-white"
                style={{
                  background: FUNNEL_COLORS[index] ?? FUNNEL_COLORS[FUNNEL_COLORS.length - 1],
                  clipPath: index === 0
                    ? "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)"
                    : "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)",
                  paddingLeft: index === 0 ? 16 : 30,
                  paddingRight: 24,
                }}
              >
                <p className="text-[13px] leading-tight">{STAGE_LABEL[step.stage]}</p>
                <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums">{step.count}</p>
                <p className="mt-1 text-xs text-white/75">{percent}%</p>
              </div>
              <p className={`mt-2 h-5 text-center text-sm font-medium ${drop ? "text-[#e11d48]" : "text-transparent"}`}>{drop ? `−${step.loss}%` : "0"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ tone, label, value, hint, bars }: { tone: "green" | "blue" | "violet" | "rose"; label: string; value: number; hint: string; bars: number[] }) {
  const palette = {
    green: ["border-[#d4f2e6] bg-[#f2fbf7]", "text-[#07885f]", "#12a878"],
    blue: ["border-[#d9e8fb] bg-[#f4f8ff]", "text-[#2563eb]", "#2563eb"],
    violet: ["border-[#e6dcfb] bg-[#f7f4ff]", "text-[#6d28d9]", "#7c3aed"],
    rose: ["border-[#f5d6dc] bg-[#fff6f7]", "text-[#d1435b]", "#d1435b"],
  }[tone];
  const max = Math.max(1, ...bars);
  return (
    <article className={`rounded-[10px] border px-4 py-3 ${palette[0]}`}>
      <p className="text-sm text-[#52606d]">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className={`text-3xl font-semibold tabular-nums ${palette[1]}`}>{value}</p>
        <span className="flex h-8 items-end gap-0.5" aria-hidden>
          {bars.map((item, index) => (
            <span key={index} className="w-1 rounded-sm" style={{ height: `${Math.max(item ? 15 : 4, (item / max) * 100)}%`, background: palette[2], opacity: item ? 1 : 0.25 }} />
          ))}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#667085]">{hint}</p>
    </article>
  );
}

function BarChart({ series }: { series: { day: string; registered: number; first: number }[] }) {
  const max = Math.max(1, ...series.map((item) => Math.max(item.registered, item.first)));
  return (
    <div className="mt-3">
      <div className="flex h-28 items-stretch gap-1" role="img" aria-label="Регистрации и первые заказы за 14 дней">
        {series.map((item) => (
          <div key={item.day} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5" title={`${item.day}: заявки ${item.registered}, 1-й заказ ${item.first}`}>
            <span className="w-1/2 rounded-sm bg-[#2563eb]" style={{ height: item.registered ? `${Math.max(8, (item.registered / max) * 100)}%` : "0%" }} />
            <span className="w-1/2 rounded-sm bg-[#12a878]" style={{ height: item.first ? `${Math.max(8, (item.first / max) * 100)}%` : "0%" }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[#98a2b3]">
        <span>{series[0] ? `${series[0].day.slice(8)}.${series[0].day.slice(5, 7)}` : ""}</span>
        <span>{series.at(-1) ? `${series.at(-1)!.day.slice(8)}.${series.at(-1)!.day.slice(5, 7)}` : ""}</span>
      </div>
      <p className="mt-2 flex gap-3 text-xs text-[#667085]">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#2563eb]" /> Зарегистрировано</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#12a878]" /> 1-й заказ</span>
      </p>
    </div>
  );
}

function Donut({ total, slices }: { total: number; slices: { value: number; color: string }[] }) {
  const radius = 42;
  const length = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={`${total} заявок по источникам`}>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#eef1f4" strokeWidth="14" />
      {slices.map((slice, index) => {
        const dash = (slice.value / total) * length;
        const node = (
          <circle
            key={index}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${length - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
          />
        );
        offset += dash;
        return node;
      })}
      <text x="60" y="58" textAnchor="middle" className="fill-[#1f2933] text-[18px] font-semibold">{total}</text>
      <text x="60" y="74" textAnchor="middle" className="fill-[#667085] text-[10px]">заявки</text>
    </svg>
  );
}

function Situation({ tone, label, value, hint, href }: { tone: "green" | "blue" | "amber" | "rose"; label: string; value: string; hint: string; href: string }) {
  const color = { green: "text-[#07885f]", blue: "text-[#2563eb]", amber: "text-[#b7791f]", rose: "text-[#d1435b]" }[tone];
  return (
    <Link href={href} className="rounded-lg border border-[#e6e8ec] bg-[#f8fafc] px-3 py-2 hover:border-[#c5d4e8]">
      <p className="text-xs text-[#667085]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-[#98a2b3]">{hint}</p>
    </Link>
  );
}

function StatusPill({ status }: { status: WorkStatus }) {
  const label = status === "working" ? "На месте" : status === "away" ? "Отошёл" : WORK_LABEL[status];
  const tone = status === "working"
    ? "bg-[#e7f6ee] text-[#1f7a45]"
    : status === "away"
      ? "bg-[#fff4e5] text-[#b45309]"
      : "bg-[#f4f6f8] text-[#667085]";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

function StageBadge({ stage }: { stage: RecruitStage }) {
  const label = stage === "first_order" ? "Сделан" : stage === "stopped" ? "Остановлен" : stage === "application" || stage === "call" ? "Новая" : "В процессе";
  const tone = stage === "first_order"
    ? "bg-[#e7f6ee] text-[#1f7a45]"
    : stage === "stopped"
      ? "bg-[#fff1f2] text-[#d1435b]"
      : stage === "application" || stage === "call"
        ? "bg-[#fff4e5] text-[#b45309]"
        : "bg-[#e8f1fb] text-[#1d5fa7]";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

function Avatar({ name, id }: { name: string; id: string }) {
  const colors = ["#2563eb", "#12a878", "#7c3aed", "#d97706", "#d1435b", "#0891b2"];
  let hash = 0;
  for (const char of id) hash += char.charCodeAt(0);
  const letter = name.trim().slice(0, 1).toUpperCase();
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs text-white" style={{ background: colors[hash % colors.length] }}>{letter}</span>;
}
