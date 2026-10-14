"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CHART,
  DRIVERS,
  FUNNEL,
  NOTICES,
  RECENT,
  STAGE_LABEL,
  STAGE_ORDER,
  STAGE_PILL,
  STATUS,
  TASKS,
  type DemoTask,
  type Stage,
} from "./workspace-data";

type Tab = "all" | "mine" | "new" | "attention";
type Shift = "present" | "away" | "ended";

const PANEL = "rounded-lg border border-[#1b2641] bg-[#0f172a]";
const MUTED = "text-[#8b96ad]";
const TONE = { red: "#ef4444", amber: "#f5b73b", blue: "#3b82f6", green: "#22c55e" };
const ATTENTION = ["problem", "attention", "no_answer"];
const NAV = [
  { id: "home", label: "Главная", icon: "home" },
  { id: "drivers", label: "Мои водители", icon: "users" },
  { id: "new", label: "Новые заявки", icon: "plus", badge: 12 },
  { id: "calls", label: "Звонки", icon: "phone" },
  { id: "docs", label: "Документы", icon: "doc" },
  { id: "orders", label: "Заказы", icon: "cart" },
  { id: "messages", label: "Сообщения", icon: "chat" },
  { id: "report", label: "Мой отчет", icon: "chart" },
];

export function DispatcherWorkspace() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [stageFilter, setStageFilter] = useState<Stage | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [shift, setShift] = useState<Shift>("present");
  const [elapsed, setElapsed] = useState(3 * 3600 + 24 * 60 + 15);
  const [tasks, setTasks] = useState<DemoTask[]>(TASKS);
  const [taskForm, setTaskForm] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [taskTime, setTaskTime] = useState("16:00");
  const [toast, setToast] = useState("");
  const [navId, setNavId] = useState("drivers");
  const [period, setPeriod] = useState<Record<string, string>>({ eff: "Сегодня", chart: "Сегодня", tasks: "Все" });

  useEffect(() => {
    if (shift === "ended") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [shift]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const needle = query.trim().toLowerCase();
  const rows = DRIVERS.filter((driver) => {
    if (tab === "mine" && !driver.mine) return false;
    if (tab === "new" && driver.stage !== "new") return false;
    if (tab === "attention" && !ATTENTION.includes(driver.status)) return false;
    if (stageFilter && driver.stage !== stageFilter) return false;
    if (needle && !`${driver.name} ${driver.phone}`.toLowerCase().includes(needle)) return false;
    return true;
  }).sort((a, b) => (newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  const allChecked = rows.length > 0 && rows.every((row) => checked.includes(row.id));

  function notify(text: string) {
    setToast(text);
  }

  function addTask() {
    const title = taskText.trim();
    if (!title) return;
    setTasks((list) => [...list, { id: `t${Date.now()}`, time: taskTime, title, person: "", tone: "blue" }]);
    setTaskText("");
    setTaskForm(false);
  }

  return (
    <div
      className="grid h-dvh min-w-[1100px] grid-cols-[138px_minmax(0,1fr)_232px] grid-rows-[auto_minmax(0,1fr)_128px] gap-x-2 gap-y-2 overflow-hidden bg-[#0a1020] pr-2 pb-2 text-[11px] text-[#e6ecf5]"
      style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
    >
      <aside className="col-start-1 row-span-2 row-start-1 flex flex-col bg-[#0b1326] px-1.5 py-3">
        <div className="mb-4 flex items-center gap-1.5 px-1">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
            <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" stroke="#4f8cff" strokeWidth="1.6" />
            <path d="m8.5 15 3.5-7 3.5 7M10 12.5h4" stroke="#e6ecf5" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[15px] font-bold tracking-wide">AKJOL</span>
        </div>
        <nav className="space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setNavId(item.id)}
              className={`flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[10px] ${navId === item.id ? "bg-[#2563eb] text-white" : "text-[#aeb8cc] hover:bg-[#121c33]"}`}
            >
              <Icon name={item.icon} />
              <span className="truncate">{item.label}</span>
              {item.badge ? <span className="ml-auto rounded-full bg-[#ef4444] px-1 text-[8px] font-semibold text-white">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <Link href="/" className="mt-auto flex h-7 items-center gap-2 rounded-md px-2 text-[#aeb8cc] hover:bg-[#121c33]">
          <Icon name="book" />
          Инструкции
        </Link>
      </aside>

      <div className="col-span-2 col-start-2 row-start-1 flex min-w-0 flex-col gap-2 pt-2">
        <header className="flex h-9 items-center gap-2 [&>*]:shrink-0 [&>:first-child]:shrink">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-[20px] font-bold leading-tight whitespace-nowrap">
              Рабочее место диспетчера
              <span className="rounded border border-[#2b4a8f] px-1 text-[9px] font-medium text-[#6aa3ff]" title="Демонстрационные данные, не связаны с реальной статистикой">демо</span>
            </h1>
            <p className={`${MUTED} truncate text-[10px]`}>Обработка заявок, регистрация водителей и контроль до 1-го заказа</p>
          </div>
          <span className={`flex h-7 items-center gap-1.5 rounded-md border px-2 ${shift === "ended" ? "border-[#2a3650] text-[#8b96ad]" : "border-[#1f5a3a] bg-[#0f2a1e] text-[#4ade80]"}`}>
            <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${shift === "ended" ? "bg-[#2a3650]" : "bg-[#22c55e]"}`}>
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none"><path d="m2.5 5 2 2 3-4" stroke="#0a1020" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </span>
            <span>
              <span className="block text-[10px] font-semibold leading-none">{shift === "ended" ? "Смена завершена" : "Смена активна"}</span>
              <span className="block text-[9px] leading-none opacity-80">09:00 – 18:00</span>
            </span>
          </span>
          <span className="rounded-md border border-[#1b2641] bg-[#0f172a] px-2 py-1 text-[12px] font-semibold tabular-nums">{clock(elapsed)}</span>
          <HeaderButton active={shift === "present"} tone="blue" onClick={() => shift !== "ended" && setShift("present")}>На месте</HeaderButton>
          <HeaderButton active={shift === "away"} tone="amber" onClick={() => shift !== "ended" && setShift("away")}>Отошел</HeaderButton>
          <HeaderButton tone="red" onClick={() => { setShift("ended"); notify("Смена завершена. Таймер остановлен."); }}>Завершить смену</HeaderButton>
          <button type="button" className="relative grid h-7 w-7 place-items-center rounded-md hover:bg-[#121c33]" onClick={() => notify("Непрочитанных уведомлений: 4")} aria-label="Уведомления">
            <Icon name="bell" />
            <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
          </button>
          <span className="flex items-center gap-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#d7a27a] to-[#8c5a3c] text-[10px] font-semibold text-white">АН</span>
            <span>
              <span className="block font-semibold leading-tight">Айгерим Н.</span>
              <span className={`block text-[9px] leading-tight ${MUTED}`}>Диспетчер</span>
            </span>
          </span>
        </header>

        <div className="grid grid-cols-5 gap-2">
          <Kpi icon="users" tone="#2563eb" label="Мои заявки" value="24" hint="+6 сегодня" hintTone="#4ade80" />
          <Kpi icon="phone" tone="#2563eb" label="Звонки сегодня" value="18 / 24" hint="75% выполнено" />
          <Kpi icon="user-check" tone="#16a34a" label="Зарегистрировано" value="12" hint="+3 сегодня" hintTone="#4ade80" />
          <Kpi icon="car" tone="#2563eb" label="Дошли до 1-го заказа" value="8" hint="67% от зарегистрированных" />
          <Kpi icon="chart" tone="#2563eb" label="Активных водителей" value="10" hint="83% от моих зарегистрированных" />
        </div>
      </div>

          <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 flex-col gap-2">
            <section className={`${PANEL} px-3 py-2`}>
              <h2 className="text-[11px] font-semibold">Мои водители по этапам</h2>
              <div className="mt-1.5 flex items-stretch gap-2">
                <div className="flex min-w-0 flex-1">
                  {FUNNEL.map((item, index) => {
                    const active = stageFilter === item.stage;
                    return (
                      <button
                        key={item.stage}
                        type="button"
                        onClick={() => setStageFilter(active ? null : item.stage)}
                        title={`${item.title}: ${item.count}`}
                        className={`relative -ml-2 h-[54px] min-w-0 flex-1 pr-2 pl-3.5 text-left first:ml-0 first:pl-2.5 ${active ? "ring-2 ring-white/70" : ""}`}
                        style={{
                          background: item.color,
                          clipPath: index === 0
                            ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
                            : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                          zIndex: FUNNEL.length - index,
                        }}
                      >
                        <span className="block truncate text-[9.5px] font-semibold text-white">{item.title}</span>
                        <span className="block text-[15px] font-bold leading-tight text-white">{item.count}</span>
                        <span className="block truncate text-[8px] text-white/75">{item.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => { setTab("attention"); setStageFilter(null); }}
                  className="h-[54px] w-[96px] shrink-0 rounded-md border border-[#7f1d1d] bg-[#3b0f14] px-2 text-left"
                >
                  <span className="block text-[9.5px] font-semibold text-[#ff6b6b]">Проблемные</span>
                  <span className="block text-[15px] font-bold leading-tight text-[#ff6b6b]">2</span>
                  <span className="block truncate text-[8px] text-[#f0a3a3]">Требуют внимания</span>
                </button>
              </div>
            </section>

            <section className={`${PANEL} flex min-h-0 flex-1 flex-col`}>
              <div className="flex h-[29px] items-center gap-1 border-b border-[#1b2641] px-2">
                <TabButton active={tab === "all"} onClick={() => setTab("all")} label="Все водители" badge="43" />
                <TabButton active={tab === "mine"} onClick={() => setTab("mine")} label="Мои" badge="24" />
                <TabButton active={tab === "new"} onClick={() => setTab("new")} label="Новые" badge="12" red />
                <TabButton active={tab === "attention"} onClick={() => setTab("attention")} label="Требуют внимания" badge="5" red />
                <div className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap">
                  <label className="flex h-6 w-[126px] items-center gap-1.5 rounded-md border border-[#1b2641] bg-[#0b1326] px-2">
                    <Icon name="search" />
                    <input className="w-full bg-transparent text-[10px] outline-none placeholder:text-[#5f6b84]" placeholder="Поиск по имени, телефону..." value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                  <div className="relative">
                    <button type="button" onClick={() => setFiltersOpen((value) => !value)} className={`flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] ${stageFilter ? "border-[#2563eb] text-[#6aa3ff]" : "border-[#1b2641] bg-[#0b1326] text-[#c5cde0]"}`}>
                      <Icon name="filter" />
                      Фильтры
                    </button>
                    {filtersOpen ? (
                      <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-[#1b2641] bg-[#0f172a] p-1 shadow-xl">
                        <button type="button" className={`block w-full rounded px-2 py-1 text-left text-[10px] hover:bg-[#121c33] ${stageFilter === null ? "text-[#6aa3ff]" : ""}`} onClick={() => { setStageFilter(null); setFiltersOpen(false); }}>Все этапы</button>
                        {STAGE_ORDER.map((stage) => (
                          <button key={stage} type="button" className={`block w-full rounded px-2 py-1 text-left text-[10px] hover:bg-[#121c33] ${stageFilter === stage ? "text-[#6aa3ff]" : ""}`} onClick={() => { setStageFilter(stage); setFiltersOpen(false); }}>{STAGE_LABEL[stage]}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => setNewestFirst((value) => !value)} className="flex h-6 items-center gap-1 rounded-md border border-[#1b2641] bg-[#0b1326] px-1.5 text-[10px] text-[#c5cde0]">
                    {newestFirst ? "Сначала новые" : "Сначала старые"}
                    <Icon name="chevron" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full table-fixed border-collapse text-[9px] leading-[12px]">
                  <colgroup>
                    <col className="w-[24px]" /><col className="w-[90px]" /><col className="w-[78px]" /><col className="w-[84px]" /><col className="w-[110px]" /><col className="w-[70px]" /><col className="w-[42px]" /><col /><col className="w-[66px]" />
                  </colgroup>
                  <thead className={`${MUTED} text-left`}>
                    <tr className="h-[22px] border-b border-[#1b2641]">
                      <th className="px-2"><Check checked={allChecked} onChange={() => setChecked(allChecked ? [] : rows.map((row) => row.id))} /></th>
                      <th className="px-1 font-medium">Водитель</th>
                      <th className="px-1 font-medium">Телефон</th>
                      <th className="px-1 font-medium">Этап регистрации</th>
                      <th className="px-1 font-medium">Статус</th>
                      <th className="truncate px-1 font-medium">Ответственный</th>
                      <th className="px-1 font-medium">Дата</th>
                      <th className="px-1 font-medium">Следующее действие</th>
                      <th className="px-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={9} className={`px-3 py-6 text-center ${MUTED}`}>По этим условиям водителей нет</td></tr>
                    ) : rows.map((driver) => {
                      const status = STATUS[driver.status];
                      const stageIndex = STAGE_ORDER.indexOf(driver.stage);
                      const progress = ((stageIndex + 1) / STAGE_ORDER.length) * 100;
                      const isChecked = checked.includes(driver.id);
                      return (
                        <tr key={driver.id} className={`border-b border-[#141d33] ${isChecked ? "bg-[#121c33]" : "hover:bg-[#0c1529]"}`}>
                          <td className="px-2 py-[3px]"><Check checked={isChecked} onChange={() => setChecked((list) => (isChecked ? list.filter((id) => id !== driver.id) : [...list, driver.id]))} /></td>
                          <td className="px-1 py-[3px]">
                            <span className="flex items-center gap-1.5">
                              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[8px] font-semibold text-white" style={{ background: driver.avatar }}>{driver.name.slice(0, 1)}</span>
                              <span className="truncate font-medium">{driver.name}</span>
                            </span>
                          </td>
                          <td className="px-1 py-[3px] whitespace-nowrap tabular-nums">{driver.phone}</td>
                          <td className="px-1 py-[3px]">
                            <span className="block truncate">{STAGE_LABEL[driver.stage]}</span>
                            <span className="mt-0.5 block h-1 w-[72px] overflow-hidden rounded-full bg-[#1b2641]">
                              <span className="block h-full rounded-full" style={{ width: `${progress}%`, background: driver.status === "problem" ? "#ef4444" : stageIndex >= 4 ? "#22c55e" : "#3b82f6" }} />
                            </span>
                          </td>
                          <td className="px-1 py-[3px]">
                            <span className="inline-flex h-[18px] max-w-full items-center gap-1 truncate rounded px-1.5 text-[8.5px] font-medium" style={{ background: status.bg, color: status.text }}>
                              <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: status.text }} />
                              <span className="truncate">{status.label}</span>
                            </span>
                          </td>
                          <td className="px-1 py-[3px]">{driver.mine ? "Я" : "—"}</td>
                          <td className="px-1 py-[3px]">
                            <span className="block leading-tight">{driver.date.slice(0, 5)}</span>
                            <span className={`block leading-tight ${MUTED}`}>{driver.date.slice(6)}</span>
                          </td>
                          <td className="px-1 py-[3px]">
                            <span className="block truncate leading-tight">{driver.next}</span>
                            <span className={`block truncate leading-tight ${MUTED}`}>{driver.nextSub}</span>
                          </td>
                          <td className="px-1 py-[3px]">
                            <span className="flex items-center justify-end gap-1">
                              <RowAction label="Позвонить" onClick={() => notify(`Звонок ${driver.name}: телефония не подключена`)}><Icon name="phone" /></RowAction>
                              <RowAction label="Написать" onClick={() => notify(`Сообщение для ${driver.name}: демо-режим`)}><Icon name="chat" /></RowAction>
                              <RowAction label="Ещё" onClick={() => notify(`Карточка ${driver.name}: демо-режим`)}><Icon name="dots" /></RowAction>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

            <div className="col-span-2 col-start-1 row-start-3 grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2 pl-2">
              <section className={`${PANEL} px-3 py-2`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Моя эффективность</h2>
                  <Select value={period.eff} options={["Сегодня", "Неделя", "Месяц"]} onChange={(value) => setPeriod((state) => ({ ...state, eff: value }))} />
                </div>
                <div className="mt-2 flex items-center gap-4">
                  <Donut percent={67} />
                  <div className="grid flex-1 grid-cols-5 gap-1">
                    <Eff value="24" label="Новые заявки" />
                    <Eff value="18" label="Звонки" sub="75%" />
                    <Eff value="12" label="Зарегистрировано" sub="50%" />
                    <Eff value="8" label="1-й заказ" sub="67%" />
                    <Eff value="10" label="Активных" sub="83%" />
                  </div>
                </div>
              </section>
              <section className={`${PANEL} flex flex-col px-3 py-2`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">График моей работы</h2>
                  <Select value={period.chart} options={["Сегодня", "Вчера", "Неделя"]} onChange={(value) => setPeriod((state) => ({ ...state, chart: value }))} />
                </div>
                <BarChart />
                <div className="mt-1 flex items-center justify-center gap-3 text-[9px]">
                  <Legend color="#3b82f6" label="Звонки" />
                  <Legend color="#22c55e" label="Регистрации" />
                  <Legend color="#8b5cf6" label="1-й заказ" />
                </div>
              </section>
            </div>

          <aside className="col-start-3 row-span-2 row-start-2 flex min-h-0 flex-col gap-2 overflow-hidden text-[9px] leading-[11px] [&_h2]:text-[10.5px] [&_h2]:whitespace-nowrap">
            <section className={`${PANEL} px-2.5 py-2`}>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1 font-semibold">Мои задачи сегодня <span className="rounded-full bg-[#ef4444] px-1.5 text-[9px] text-white">{tasks.length}</span></h2>
                <Select value={period.tasks} options={["Все", "Срочные", "Выполненные"]} onChange={(value) => setPeriod((state) => ({ ...state, tasks: value }))} />
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {tasks.filter((task) => period.tasks !== "Срочные" || task.tone === "red").map((task) => (
                  <li key={task.id} className="flex items-start gap-1.5">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[task.tone] }} />
                    <span className={`w-7 shrink-0 tabular-nums ${MUTED}`}>{task.time}</span>
                    <span className="min-w-0">
                      <span className="block truncate">{task.title}</span>
                      <span className={`block truncate text-[8px] ${task.note ? "text-[#ff6b6b]" : MUTED}`}>{task.note ?? task.person}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {taskForm ? (
                <form className="mt-2 flex gap-1" onSubmit={(event) => { event.preventDefault(); addTask(); }}>
                  <input className="w-12 rounded border border-[#1b2641] bg-[#0b1326] px-1 text-[10px] outline-none" value={taskTime} onChange={(event) => setTaskTime(event.target.value)} aria-label="Время" />
                  <input className="min-w-0 flex-1 rounded border border-[#1b2641] bg-[#0b1326] px-1.5 text-[10px] outline-none" placeholder="Задача" value={taskText} onChange={(event) => setTaskText(event.target.value)} aria-label="Задача" />
                  <button type="submit" className="rounded bg-[#2563eb] px-2 text-[10px] text-white">Ок</button>
                </form>
              ) : (
                <button type="button" onClick={() => setTaskForm(true)} className="mt-2 flex h-7 w-full items-center justify-center gap-1 rounded-md border border-[#2b4a8f] text-[10px] text-[#6aa3ff] hover:bg-[#121c33]">
                  + Добавить задачу
                </button>
              )}
            </section>

            <section className={`${PANEL} px-2.5 py-2`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Последние заявки</h2>
                <button type="button" className={`flex items-center gap-0.5 text-[10px] ${MUTED}`} onClick={() => { setTab("new"); setStageFilter(null); }}>Все <Icon name="chevron" /></button>
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {RECENT.map((item) => (
                  <li key={item.id} className="flex items-center gap-1.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[8px] font-semibold text-white" style={{ background: item.avatar }}>{item.name.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.name}</span>
                      <span className={`block text-[8px] ${MUTED}`}>{item.date}</span>
                    </span>
                    <span className="flex h-4 shrink-0 items-center gap-1 rounded px-1.5 text-[8px]" style={{ background: STAGE_PILL[item.stage].bg, color: STAGE_PILL[item.stage].text }}>
                      <span className="h-1 w-1 rounded-full" style={{ background: STAGE_PILL[item.stage].text }} />
                      {STAGE_LABEL[item.stage]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${PANEL} min-h-0 flex-1 px-2.5 py-2`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Последние уведомления</h2>
                <button type="button" className={`flex items-center gap-0.5 text-[10px] ${MUTED}`} onClick={() => notify("Все уведомления: демо-список")}>Все <Icon name="chevron" /></button>
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {NOTICES.map((item) => (
                  <li key={item.id} className="flex items-start gap-1.5">
                    <span className={`w-7 shrink-0 tabular-nums ${MUTED}`}>{item.time}</span>
                    <span className="mt-0.5 grid h-2.5 w-2.5 shrink-0 place-items-center rounded-full" style={{ background: TONE[item.tone] }} />
                    <span className="min-w-0">
                      <span className="block truncate">{item.title}</span>
                      <span className={`block truncate text-[8px] ${MUTED}`}>{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>

      {toast ? <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-md border border-[#1b2641] bg-[#121c33] px-3 py-2 text-[11px] shadow-xl">{toast}</div> : null}
    </div>
  );
}

function clock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
}

function HeaderButton({ children, active = false, tone, onClick }: { children: string; active?: boolean; tone: "blue" | "amber" | "red"; onClick: () => void }) {
  const look = active
    ? tone === "amber" ? "border-[#b45309] bg-[#b45309] text-white" : "border-[#2563eb] bg-[#2563eb] text-white"
    : tone === "red" ? "border-[#7f1d1d] bg-[#1a0f14] text-[#ff6b6b] hover:bg-[#2a1216]" : "border-[#1b2641] bg-[#0f172a] text-[#c5cde0] hover:bg-[#121c33]";
  return <button type="button" onClick={onClick} className={`h-7 rounded-md border px-2.5 text-[10px] font-medium ${look}`}>{children}</button>;
}

function Kpi({ icon, tone, label, value, hint, hintTone }: { icon: string; tone: string; label: string; value: string; hint: string; hintTone?: string }) {
  return (
    <div className={`${PANEL} flex h-[60px] items-center gap-2.5 px-3`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md" style={{ background: `${tone}33`, color: tone === "#16a34a" ? "#4ade80" : "#6aa3ff" }}>
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-[10px] leading-tight ${MUTED}`}>{label}</span>
        <span className="block text-[19px] font-bold leading-[22px]">{value}</span>
        <span className="block truncate text-[8.5px]" style={{ color: hintTone ?? "#8b96ad" }}>{hint}</span>
      </span>
    </div>
  );
}

function TabButton({ active, onClick, label, badge, red = false }: { active: boolean; onClick: () => void; label: string; badge: string; red?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-[29px] shrink-0 items-center gap-1 border-b-2 px-1.5 text-[10px] whitespace-nowrap ${active ? "border-[#2563eb] text-white" : "border-transparent text-[#8b96ad] hover:text-[#c5cde0]"}`}>
      {label}
      <span className={`rounded-full px-1.5 text-[9px] ${red ? "bg-[#ef4444] text-white" : "bg-[#1b2641] text-[#c5cde0]"}`}>{badge}</span>
    </button>
  );
}

function Check({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <input type="checkbox" checked={checked} onChange={onChange} className="h-3 w-3 cursor-pointer accent-[#2563eb]" aria-label="Выбрать" />;
}

function RowAction({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className="grid h-5 w-5 place-items-center rounded border border-[#1b2641] text-[#8b96ad] hover:bg-[#121c33] hover:text-white">{children}</button>;
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-5 rounded border border-[#1b2641] bg-[#0b1326] px-1 text-[9px] text-[#c5cde0] outline-none">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function Eff({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[17px] font-bold leading-tight">{value}</span>
      <span className={`block truncate text-[9px] ${MUTED}`}>{label}</span>
      {sub ? <span className="block text-[9px] text-[#4ade80]">{sub}</span> : null}
    </span>
  );
}

function Donut({ percent }: { percent: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-[64px] w-[64px] shrink-0 place-items-center">
      <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#1b2641" strokeWidth="6" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="#2563eb" strokeWidth="6" strokeDasharray={`${(percent / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="text-center">
        <span className="block text-[14px] font-bold leading-none">{percent}%</span>
        <span className={`block text-[7px] leading-tight ${MUTED}`}>Конверсия<br />в активных</span>
      </span>
    </span>
  );
}

function BarChart() {
  const max = Math.max(...CHART.flatMap((item) => [item.calls, item.regs, item.orders]), 1);
  return (
    <div className="mt-1 flex flex-1 items-end gap-1.5">
      {CHART.map((item) => (
        <div key={item.hour} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <div className="flex h-[52px] w-full items-end justify-center gap-[2px]">
            {[["calls", "#3b82f6"], ["regs", "#22c55e"], ["orders", "#8b5cf6"]].map(([key, color]) => (
              <span key={key} className="w-[5px] rounded-t-sm" style={{ height: `${(item[key as "calls" | "regs" | "orders"] / max) * 100}%`, background: color }} />
            ))}
          </div>
          <span className={`text-[8px] ${MUTED}`}>{item.hour}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className={`flex items-center gap-1 ${MUTED}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</span>;
}

function Icon({ name, size = 12 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    home: "M3 11 12 4l9 7v9H3v-9Zm6 9v-6h6v6",
    users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5M4 19c.4-2.4 2.4-4 5-4s4.6 1.6 5 4m2-3c1.8.3 3.2 1.6 3.5 3",
    plus: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 19c.4-2.4 2.4-4 5-4s4.6 1.6 5 4M18 8v6m-3-3h6",
    phone: "M8 3h3l1 4-2 1a11 11 0 0 0 6 6l1-2 4 1v3a2 2 0 0 1-2 2A15 15 0 0 1 6 5a2 2 0 0 1 2-2Z",
    doc: "M7 3h7l4 4v14H7V3Zm7 0v4h4M9 12h6M9 16h6",
    cart: "M4 5h2l2 10h10l2-7H7M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    chat: "M5 6h14v9H8l-3 3V6Z",
    chart: "M5 19V5M5 19h14M8 16v-4m4 4V8m4 8v-6",
    book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Zm0 0v16",
    bell: "M6 16V11a6 6 0 1 1 12 0v5l1 2H5l1-2Zm4 3a2 2 0 0 0 4 0",
    search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-1.5L20 20",
    filter: "M4 6h16M7 12h10M10 18h4",
    chevron: "m8 10 4 4 4-4",
    dots: "M12 6h.01M12 12h.01M12 18h.01",
    "user-check": "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 19c.4-2.4 2.4-4 5-4s4.6 1.6 5 4m2-6 2 2 4-4",
    car: "M5 16l1.5-5h11L19 16M5 16h14v3H5v-3Zm2 0v-1m10 1v-1M7 19v1m10-1v1",
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name] ?? paths.dots} />
    </svg>
  );
}
