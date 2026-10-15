"use client";

import Link from "next/link";
import { useState } from "react";
import { NoAccess } from "@/components/ui";
import { awaySpans, currentStatus, eventsOnDate, summarizeDate } from "@/lib/attendance";
import { fullName, WORK_LABEL } from "@/lib/labels";
import {
  PIPELINE,
  SOURCE_LEAD_LABEL,
  STAGE_LABEL,
  STAGE_LABEL_KY,
  STOP_LABEL,
  countReached,
  dailySeries,
  delta,
  driversInWindow,
  hasFirstOrder,
  hoursToFirst,
  lossPercent,
  recruitmentWindow,
  sourceCounts,
  stopCounts,
} from "@/lib/recruitment";
import { useCrm } from "@/lib/store";
import { useTelephony } from "@/lib/telephony/client";
import { bishkekDateString, formatDuration } from "@/lib/time";
import type { RecruitStage } from "@/lib/types";

export function RecruitmentScreen() {
  const crm = useCrm();
  const telephony = useTelephony();
  const [days, setDays] = useState<1 | 7 | 30 | 0>(7);
  const [demo, setDemo] = useState(false);
  const [lang, setLang] = useState<"ru" | "ky">("ru");
  if (!crm.isAdmin) return <NoAccess />;
  if (!crm.now) return <p className="text-sm text-[#667085]">Загрузка…</p>;
  const today = bishkekDateString(new Date(crm.now));
  const all = crm.state.drivers;
  const real = all.filter((driver) => !driver.demo);
  const showDemo = demo || real.length === 0;
  const pool = all.filter((driver) => showDemo || !driver.demo);
  const earliest = pool.reduce((min, driver) => {
    const day = bishkekDateString(new Date(driver.createdAt));
    return day < min ? day : min;
  }, today);
  const window = days === 0
    ? { from: earliest, to: today, prevFrom: earliest, prevTo: earliest }
    : recruitmentWindow(days, today);
  const current = driversInWindow(pool, window.from, window.to);
  const previous = driversInWindow(pool, window.prevFrom, window.prevTo);
  const registered = current.length;
  const registeredPrev = previous.length;
  const active = current.filter((driver) => driver.stage !== "stopped" && (driver.availability === "available" || driver.stage === "activation" || driver.stage === "first_order")).length;
  const activePrev = previous.filter((driver) => driver.stage !== "stopped" && (driver.availability === "available" || driver.stage === "activation" || driver.stage === "first_order")).length;
  const first = current.filter((driver) => hasFirstOrder(driver, crm.state.orders)).length;
  const firstPrev = previous.filter((driver) => hasFirstOrder(driver, crm.state.orders)).length;
  const lost = current.filter((driver) => !hasFirstOrder(driver, crm.state.orders)).length;
  const lostPrev = previous.filter((driver) => !hasFirstOrder(driver, crm.state.orders)).length;
  const stageName = (stage: RecruitStage) => (lang === "ky" ? STAGE_LABEL_KY[stage] : STAGE_LABEL[stage]);
  const steps = PIPELINE.map((stage, index) => {
    const count = countReached(current, crm.state.orders, stage);
    const prev = index === 0 ? count : countReached(current, crm.state.orders, PIPELINE[index - 1]);
    return { stage, count, loss: index === 0 ? null : lossPercent(prev, count), share: registered ? Math.round((count / registered) * 100) : 0 };
  });
  const series = dailySeries(current, crm.state.orders, window.from, window.to);
  const sources = sourceCounts(current);
  const stops = stopCounts(current);
  const staff = crm.state.users.filter((user) => user.role === "dispatcher" && user.accountStatus === "active");
  const rows = staff.map((user) => {
    const owned = current.filter((driver) => driver.ownerId === user.id);
    const brought = owned.filter((driver) => hasFirstOrder(driver, crm.state.orders));
    const hours = brought.map((driver) => hoursToFirst(driver, crm.state.orders)).filter((value): value is number => value != null);
    const scores = crm.state.ratings.filter((item) => item.dispatcherId === user.id);
    let away = 0;
    let worked = 0;
    for (const day of series.map((item) => item.day)) {
      const events = eventsOnDate(crm.state.events, user.id, day);
      const summary = summarizeDate(crm.state.events, user.id, day, crm.now, user.scheduleStart);
      worked += summary.workedMs;
      for (const span of awaySpans(events)) {
        const from = new Date(span.from).getTime();
        const to = span.to ? new Date(span.to).getTime() : crm.now;
        if (to > from) away += to - from;
      }
    }
    return {
      user,
      status: currentStatus(crm.state.events, user.id, new Date(crm.now)),
      registered: owned.length,
      active: owned.filter((driver) => driver.availability === "available" && driver.stage !== "stopped").length,
      first: brought.length,
      conversion: owned.length ? Math.round((brought.length / owned.length) * 100) : 0,
      worked,
      away,
      avgHours: hours.length ? hours.reduce((sum, value) => sum + value, 0) / hours.length : null,
      rating: scores.length ? scores.reduce((sum, item) => sum + item.score, 0) / scores.length : null,
      ratingCount: scores.length,
    };
  }).sort((a, b) => b.first - a.first || b.registered - a.registered);
  const maxBar = Math.max(1, ...series.map((item) => Math.max(item.registered, item.first)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{lang === "ky" ? "Жетекчи панели" : "Рекрутинг водителей"}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[#667085]">
            Заявки из карточек водителей. Демо-записи подписаны и не смешиваются с реальными, пока вы сами их не включите.
            {real.length === 0 ? " Реальных заявок пока нет — в расчёт входят демо-водители, они подписаны." : ""}
            {current.length === 0 && pool.length > 0 ? " В этом периоде заявок нет: откройте «Все»." : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="h-9 rounded-lg border border-[#e6e8ec] bg-white px-3 text-sm" onClick={() => setLang(lang === "ru" ? "ky" : "ru")}>{lang === "ru" ? "Кыргызча" : "Русский"}</button>
          <button type="button" className={`h-9 rounded-lg border px-3 text-sm ${showDemo ? "border-[#2e6db4] bg-[#e8f1fb]" : "border-[#e6e8ec] bg-white"}`} onClick={() => setDemo((value) => !value)}>
            {showDemo ? "Демо включены" : "Без демо"}
          </button>
          {([1, 7, 30, 0] as const).map((item) => (
            <button key={item} type="button" className={`h-9 rounded-lg px-3 text-sm ${days === item ? "bg-[#2e6db4] text-white" : "bg-white text-[#52606d]"}`} onClick={() => setDays(item)}>
              {item === 1 ? "День" : item === 7 ? "7 дней" : item === 30 ? "30 дней" : "Все"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Зарегистрировано" value={registered} hint={days === 0 ? { tone: "flat", text: "за всё время" } : delta(registered, registeredPrev)} />
        <Kpi label="Активные" value={active} hint={days === 0 ? { tone: "flat", text: "за всё время" } : delta(active, activePrev)} extra={registered ? `${Math.round((active / registered) * 100)}% от периода` : "заявок в периоде нет"} />
        <Kpi label="Совершили 1-й заказ" value={first} hint={days === 0 ? { tone: "flat", text: "за всё время" } : delta(first, firstPrev)} extra={registered ? `${Math.round((first / registered) * 100)}% конверсии` : "конверсия не считается от нуля"} good />
        <Kpi label="Не дошли до 1-го заказа" value={lost} hint={days === 0 ? { tone: "flat", text: "за всё время" } : delta(lost, lostPrev)} extra={registered ? `${Math.round((lost / registered) * 100)}% периода` : ""} loss />
      </div>

      <section className="crm-panel p-4">
        <h3 className="font-semibold">Воронка регистрации</h3>
        <div className="mt-3 space-y-2">
          {steps.map((step) => (
            <div key={step.stage} className="grid items-center gap-2 sm:grid-cols-[140px_minmax(0,1fr)_90px]">
              <span className="text-sm">{stageName(step.stage)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-[#eef1f4]">
                <span className="block h-full rounded-full bg-[#2e6db4]" style={{ width: `${step.share}%` }} />
              </span>
              <span className="text-sm tabular-nums text-[#52606d]">{step.count} · {step.share}%{step.loss != null && step.loss > 0 ? ` · −${step.loss}%` : ""}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Почему остановились</h3>
          {stops.length === 0 ? <p className="mt-2 text-sm text-[#667085]">Остановленных заявок с причиной в этом периоде нет</p> : stops.map((item) => (
            <p key={item.reason} className="mt-2 text-sm">{STOP_LABEL[item.reason]} · {item.count}</p>
          ))}
        </section>
        <section className="crm-panel p-4">
          <h3 className="font-semibold">Источники заявок</h3>
          {sources.length === 0 ? <p className="mt-2 text-sm text-[#667085]">Источников в периоде нет</p> : sources.map((item) => (
            <p key={item.source} className="mt-2 text-sm">{SOURCE_LEAD_LABEL[item.source]} · {item.count}</p>
          ))}
        </section>
      </div>

      <section className="crm-panel overflow-x-auto">
        <h3 className="px-4 py-3 font-semibold">Диспетчеры</h3>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#f7f8fa] text-xs text-[#667085]">
            <tr>{["Сотрудник", "Статус", "Заявки", "Активные", "1-й заказ", "Конверсия", "На месте", "Отошёл", "До 1-го заказа", "Оценка"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user.id} className="border-t border-[#e6e8ec]">
                <td className="px-3 py-2">{fullName(row.user)}</td>
                <td className="px-3 py-2">{WORK_LABEL[row.status]}</td>
                <td className="px-3 py-2 tabular-nums">{row.registered}</td>
                <td className="px-3 py-2 tabular-nums">{row.active}</td>
                <td className="px-3 py-2 tabular-nums">{row.first}</td>
                <td className="px-3 py-2 tabular-nums">{row.registered ? `${row.conversion}%` : "—"}</td>
                <td className="px-3 py-2">{formatDuration(row.worked)}</td>
                <td className="px-3 py-2">{formatDuration(row.away)}</td>
                <td className="px-3 py-2">{row.avgHours == null ? "нет данных" : `${row.avgHours.toFixed(1)} ч`}</td>
                <td className="px-3 py-2">{row.rating == null ? "нет оценок" : `${row.rating.toFixed(1)} · ${row.ratingCount}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-[#98a2b3]">Оценки только вручную. Авторассылка WhatsApp и SMS не подключена, поэтому пустая колонка не означает оценку 0.</p>
      </section>

      <section className="crm-panel p-4">
        <h3 className="font-semibold">Регистрации и 1-й заказ по дням</h3>
        <div className="mt-3 flex h-28 items-end gap-1">
          {series.map((item) => (
            <div key={item.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-20 w-full items-end justify-center gap-0.5">
                <span className="w-1/2 rounded-sm bg-[#2e6db4]" style={{ height: `${(item.registered / maxBar) * 100}%` }} />
                <span className="w-1/2 rounded-sm bg-[#1f7a45]" style={{ height: `${(item.first / maxBar) * 100}%` }} />
              </div>
              <span className="text-[10px] text-[#98a2b3]">{item.day.slice(8)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#98a2b3]">Синий — заявки, зелёный — первый выполненный заказ. Нулевая полоса — в этот день записей не было.</p>
      </section>

      <section className="crm-panel p-4 text-sm text-[#52606d]">
        <h3 className="font-semibold text-[#1f2933]">Связь</h3>
        <p className="mt-2">Телефония: {telephony.status.connected ? "провайдер отвечает" : "не подключена"}. Каскад «на месте» уже есть в сервере телефонии, но без провайдера звонки и пропущенные не создаются.</p>
        <p className="mt-1">WhatsApp и оценка 1–5 после диалога не отправляются. Akjol Drive, баланс и выводы на банки не подключены — сумм оттуда нет.</p>
        <p className="mt-2"><Link href="/employees" className="text-[#1d5fa7]">Карточки водителей</Link></p>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, extra, good = false, loss = false }: { label: string; value: number; hint: { tone: "up" | "down" | "flat"; text: string }; extra?: string; good?: boolean; loss?: boolean }) {
  const positive = loss ? hint.tone === "down" : hint.tone === "up";
  const negative = loss ? hint.tone === "up" : hint.tone === "down";
  const color = hint.tone === "flat" ? "text-[#667085]" : positive || good && hint.tone === "up" ? "text-[#1f7a45]" : negative ? "text-[#c24141]" : "text-[#667085]";
  return (
    <article className="crm-panel px-4 py-3">
      <p className="text-sm text-[#667085]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className={`mt-1 text-xs ${color}`}>{hint.text}</p>
      {extra ? <p className="text-xs text-[#98a2b3]">{extra}</p> : null}
    </article>
  );
}
