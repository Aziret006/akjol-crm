"use client";

import { useState } from "react";
import { canPunch, currentStatus, summarizeDate } from "@/lib/attendance";
import { EVENT_LABEL } from "@/lib/labels";
import { useCrm } from "@/lib/store";
import { bishkekDateString, formatDuration, formatTime } from "@/lib/time";
import { Button, ErrorText, Modal, WorkBadge } from "./ui";

export function AttendanceControls({ userId, showLog = true }: { userId: string; showLog?: boolean }) {
  const crm = useCrm();
  const [error, setError] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const user = crm.state.users.find((item) => item.id === userId);
  if (!user) return null;

  const today = bishkekDateString(new Date(crm.now));
  const summary = summarizeDate(crm.state.events, userId, today, crm.now, user.scheduleStart);
  const status = currentStatus(crm.state.events, userId, new Date(crm.now));
  const mine = crm.actor?.id === userId && !crm.readOnly;

  async function press(type: "arrived" | "away" | "finished") {
    setError("");
    const result = crm.punch(type);
    if (!result.ok && result.code === "confirm-finish") {
      setConfirmFinish(true);
      return;
    }
    if (!result.ok) setError(result.error);
  }

  const canStart = mine && (status === "idle" || status === "finished") && canPunch(status, "arrived");
  const canAway = mine && status === "working" && canPunch(status, "away");
  const canReturn = mine && status === "away" && canPunch(status, "arrived");
  const canFinish = mine && (status === "working" || status === "away") && canPunch(status, "finished");

  return (
    <section className="space-y-3">
      <div className="crm-panel flex flex-wrap items-center gap-2 px-3 py-2">
        <button type="button" disabled={!canStart} onClick={() => press("arrived")} className={actionClass(canStart)}>
          Начать работу
        </button>
        <PresenceSwitch
          away={status === "away"}
          enabled={canAway || canReturn}
          onAway={() => press("away")}
          onReturn={() => press("arrived")}
        />
        <button type="button" disabled={!canFinish} onClick={() => press("finished")} className={actionClass(canFinish, true)}>
          Завершить работу
        </button>
        <div className="ml-auto flex items-center gap-3">
          <WorkBadge status={status} />
          <span className="text-[13px] tabular-nums text-[#525c69]">{formatDuration(summary.workedMs)}</span>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      {crm.readOnly ? <p className="text-[13px] text-[#828b95]">Просмотр. Отметки недоступны.</p> : null}
      {showLog ? (
        <div className="crm-panel overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#f7f9fb] text-[#525c69]">
              <tr>
                <th className="px-3 py-2 font-medium">Событие</th>
                <th className="px-3 py-2 font-medium">Время</th>
              </tr>
            </thead>
            <tbody>
              {summary.events.length === 0 ? (
                <tr><td className="px-3 py-3 text-[#828b95]" colSpan={2}>Сегодня отметок нет</td></tr>
              ) : summary.events.map((event) => (
                <tr key={event.id} className="border-t border-[#eef1f4]">
                  <td className="px-3 py-2">{EVENT_LABEL[event.type]}</td>
                  <td className="px-3 py-2 tabular-nums">{formatTime(event.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {confirmFinish ? (
        <Modal title="Завершить работу?" onClose={() => setConfirmFinish(false)}>
          <p className="text-[13px] text-[#525c69]">Статус сейчас «Отошёл». Время с момента отхода в рабочие часы не войдёт.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmFinish(false)}>Отмена</Button>
            <Button onClick={() => { const result = crm.punch("finished", true); if (!result.ok) setError(result.error); setConfirmFinish(false); }}>Завершить</Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function actionClass(enabled: boolean, quiet = false) {
  if (!enabled) return "h-8 rounded bg-[#f4f7f9] px-3 text-[13px] font-medium text-[#9aa3ad] disabled:cursor-not-allowed";
  if (quiet) return "h-8 rounded border border-[#d5dde5] bg-white px-3 text-[13px] font-medium text-[#333] hover:bg-[#f5f8fb]";
  return "h-8 rounded bg-[#2e6db4] px-3 text-[13px] font-medium text-white hover:bg-[#245a96]";
}

function PresenceSwitch({
  away,
  enabled,
  onAway,
  onReturn,
}: {
  away: boolean;
  enabled: boolean;
  onAway: () => void;
  onReturn: () => void;
}) {
  return (
    <div className={`relative grid h-8 w-[168px] grid-cols-2 rounded-full bg-[#e7edf2] p-0.5 ${enabled ? "" : "opacity-60"}`}>
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 h-7 w-[calc(50%-2px)] rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.14)] transition-transform ${away ? "" : "translate-x-full"}`}
      />
      <button
        type="button"
        disabled={!enabled || away}
        onClick={onAway}
        className={`relative z-10 h-full text-[13px] font-medium disabled:cursor-default ${away ? "text-[#333]" : "text-[#6b7785]"}`}
      >
        Отошёл
      </button>
      <button
        type="button"
        disabled={!enabled || !away}
        onClick={onReturn}
        className={`relative z-10 h-full text-[13px] font-medium disabled:cursor-default ${away ? "text-[#6b7785]" : "text-[#333]"}`}
      >
        Пришёл
      </button>
    </div>
  );
}
