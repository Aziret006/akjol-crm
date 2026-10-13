"use client";

import { Fragment, useMemo, useState } from "react";
import { AttendanceControls } from "@/components/attendance-controls";
import { Button, Empty, ErrorText, Field, Modal, WorkBadge, controlClass } from "@/components/ui";
import { summarizeDate } from "@/lib/attendance";
import { downloadCsv } from "@/lib/csv";
import { EVENT_LABEL, WORK_LABEL, fullName } from "@/lib/labels";
import { useCrm } from "@/lib/store";
import { TZ, bishkekDateString, datesBetween, formatDate, formatDateTime, formatDuration, formatTime, periodBounds } from "@/lib/time";
import type { PeriodKind } from "@/lib/types";

export default function TimePage() {
  const crm = useCrm();
  if (!crm.user) return null;
  if (!crm.isAdmin) return <AttendanceControls userId={crm.user.id} />;
  return <AdminTime />;
}

function AdminTime() {
  const crm = useCrm();
  const [period, setPeriod] = useState<PeriodKind>("day");
  const [employeeId, setEmployeeId] = useState("all");
  const [opened, setOpened] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const bounds = periodBounds(period, new Date(crm.now));
  const dates = datesBetween(bounds.from, bounds.to);
  const people = crm.state.users.filter((user) => employeeId === "all" || user.id === employeeId);

  const rows = useMemo(
    () =>
      people.flatMap((user) =>
        dates.map((day) => ({
          user,
          day,
          summary: summarizeDate(crm.state.events, user.id, day, crm.now, user.scheduleStart),
        })),
      ).filter((row) => period === "day" || row.summary.events.length > 0),
    [crm.now, crm.state.events, dates, people],
  );

  function exportReport() {
    downloadCsv(`akjol-time-${bounds.from}.csv`, [
      ["Сотрудник", "Дата", "Статус", "Пришёл", "Отходы", "Закончил", "Рабочее время", "Опоздание"],
      ...rows.map((row) => [
        fullName(row.user),
        row.day,
        WORK_LABEL[row.summary.status],
        row.summary.arrivedAt ? formatTime(row.summary.arrivedAt) : "",
        row.summary.awayLabel,
        row.summary.finishedAt ? formatTime(row.summary.finishedAt) : "",
        formatDuration(row.summary.workedMs),
        row.summary.lateMin == null ? "" : row.summary.lateMin === 0 ? "вовремя" : `${row.summary.lateMin} мин`,
      ]),
    ]);
  }

  function openCorrect(eventId: string, at: string) {
    const day = bishkekDateString(new Date(at));
    setEditId(eventId);
    setDate(day);
    setTime(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(at)));
    setReason("");
    setError("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex rounded-xl bg-white p-1">
          {(["day", "week", "month"] as PeriodKind[]).map((item) => (
            <button key={item} className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === item ? "bg-[#2e6db4] text-white" : "text-[#525c69]"}`} onClick={() => setPeriod(item)} type="button">
              {item === "day" ? "День" : item === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
        <select className={`${controlClass} w-auto`} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          <option value="all">Все сотрудники</option>
          {crm.state.users.map((user) => <option key={user.id} value={user.id}>{fullName(user)}</option>)}
        </select>
        <Button variant="secondary" onClick={exportReport}>Скачать CSV</Button>
      </div>
      <p className="text-sm text-[#6b6560]">Время в часовом поясе Asia/Bishkek. В рабочее время не входят отходы.</p>
      {rows.length === 0 ? <Empty title="Смен нет" text="За выбранный период отметок не найдено." /> : (
        <div className="overflow-x-auto crm-panel">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#faf8f4] text-[#6b6560]">
              <tr>
                {["Сотрудник", "Дата", "Статус", "Пришёл", "Отходы", "Закончил", "Рабочее время", "Опоздание"].map((title) => (
                  <th key={title} className="px-4 py-3 font-medium">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = `${row.user.id}-${row.day}`;
                return (
                  <Fragment key={key}>
                    <tr className="cursor-pointer border-t border-[#f3eee6] hover:bg-[#faf8f4]" onClick={() => setOpened(opened === key ? null : key)}>
                      <td className="px-4 py-3 font-medium">{fullName(row.user)}</td>
                      <td className="px-4 py-3">{formatDate(row.day)}</td>
                      <td className="px-4 py-3"><WorkBadge status={row.summary.status} /></td>
                      <td className="px-4 py-3">{row.summary.arrivedAt ? formatTime(row.summary.arrivedAt) : "—"}</td>
                      <td className="px-4 py-3">{row.summary.awayLabel}</td>
                      <td className="px-4 py-3">{row.summary.finishedAt ? formatTime(row.summary.finishedAt) : "—"}</td>
                      <td className="px-4 py-3">{formatDuration(row.summary.workedMs)}</td>
                      <td className="px-4 py-3">{row.summary.lateMin == null ? "—" : row.summary.lateMin === 0 ? "Вовремя" : `${row.summary.lateMin} мин`}</td>
                    </tr>
                    {opened === key ? (
                      <tr key={`${key}-details`} className="border-t border-[#f3eee6] bg-[#faf8f4]">
                        <td colSpan={8} className="px-4 py-3">
                          <ul className="space-y-2">
                            {row.summary.events.map((event) => (
                              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2">
                                <span>{EVENT_LABEL[event.type]} · {formatTime(event.at)}</span>
                                <button className="text-sm crm-link" onClick={() => openCorrect(event.id, event.at)} type="button">Исправить</button>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <section className="crm-panel p-4">
        <h2 className="font-semibold">История исправлений</h2>
        {crm.state.corrections.length === 0 ? <p className="mt-2 text-sm text-[#6b6560]">Исправлений пока нет</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {crm.state.corrections.map((correction) => {
              const employee = crm.state.users.find((user) => user.id === correction.userId);
              const author = crm.state.users.find((user) => user.id === correction.actorId);
              return (
                <li key={correction.id} className="rounded-xl bg-[#faf8f4] px-3 py-2">
                  {employee ? fullName(employee) : "Сотрудник"}: {formatTime(correction.previousAt)} → {formatTime(correction.nextAt)}. {correction.reason}
                  <span className="mt-1 block text-[#6b6560]">{author ? fullName(author) : "Администратор"} · {formatDateTime(correction.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {editId ? (
        <Modal title="Исправить отметку" onClose={() => setEditId(null)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const result = crm.correctEvent(editId, date, time, reason);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setEditId(null);
            }}
          >
            <Field label="Дата"><input className={controlClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field>
            <Field label="Время, Бишкек"><input className={controlClass} type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></Field>
            <Field label="Причина"><textarea className={`${controlClass} h-24 py-2`} value={reason} onChange={(event) => setReason(event.target.value)} required /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">Сохранить</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
