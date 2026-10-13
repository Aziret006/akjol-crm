"use client";

import { useState } from "react";
import { CallReport } from "@/components/call-report";
import { Button, ErrorText, Field, NoAccess, controlClass } from "@/components/ui";
import { DESK_STATUS_LABEL, fullName } from "@/lib/labels";
import { saveCallCapacity, useTelephony } from "@/lib/telephony/client";
import { useCrm } from "@/lib/store";

export default function TelephonyPage() {
  const crm = useCrm();
  const { status, syncError } = useTelephony();
  const [limit, setLimit] = useState(String(status.maxConcurrent));
  const [seenLimit, setSeenLimit] = useState(status.maxConcurrent);
  const [error, setError] = useState("");
  if (seenLimit !== status.maxConcurrent) {
    setSeenLimit(status.maxConcurrent);
    setLimit(String(status.maxConcurrent));
  }
  if (!crm.isAdmin) return <NoAccess />;

  return (
    <div className="space-y-4">
      {!status.connected ? (
        <p className="rounded-lg border border-[#f0d0d0] bg-[#fdf6f6] px-3 py-2 text-sm text-[#b42318]">
          Телефония не подключена. Входящие звонки в CRM не поступают. Кнопки ответа в браузере нет.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Подключение" value={status.connected ? (status.provider ?? "Подключено") : "Не подключено"} />
        <Fact label="Общий номер" value={status.sharedNumber ?? "Не задан"} />
        <Fact label="В резервной очереди" value={String(status.queueCount)} hint={status.queueNote} />
        <Fact label="Активные разговоры" value={String(status.active.length)} />
        <Fact label="Доступны для звонков" value={String(status.dispatchers.filter((item) => item.status === "available").length)} />
        <Fact label="Пропущенные" value={String(status.missed)} hint="По сохранённым событиям" />
        <Fact label="Ошибки интеграции" value={String(status.errors.length)} />
        <Fact label="Звонков на диспетчера" value={String(status.maxConcurrent)} hint="Лимит назначения в CRM" />
      </div>
      {syncError ? <ErrorText>{syncError}</ErrorText> : null}
      <section className="crm-panel p-3">
        <h2 className="font-semibold">Диспетчеры</h2>
        {status.dispatchers.filter((item) => item.role === "dispatcher").length === 0 ? (
          <p className="mt-2 text-sm text-[#667085]">Сервер ещё не получил статус смены. Он появится, когда диспетчер откроет CRM.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {status.dispatchers.filter((item) => item.role === "dispatcher").map((item) => {
              const person = crm.state.users.find((user) => user.id === item.userId);
              return <li key={item.userId}>{person ? fullName(person) : item.userId}: {DESK_STATUS_LABEL[item.status]} · нагрузка {item.load}</li>;
            })}
          </ul>
        )}
      </section>
      <section className="crm-panel p-3">
        <h2 className="font-semibold">Ошибки</h2>
        {status.errors.length === 0 ? <p className="mt-2 text-sm text-[#667085]">Ошибок назначения и webhook нет</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {status.errors.slice(0, 8).map((item) => <li key={item.id}>{item.message}</li>)}
          </ul>
        )}
      </section>
      <form
        className="crm-panel flex flex-wrap items-end gap-2 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!crm.actor) return;
          void saveCallCapacity(crm.actor.id, Number(limit)).then((message) => setError(message));
        }}
      >
        <Field label="Одновременных звонков на диспетчера">
          <input className={`${controlClass} w-24`} inputMode="numeric" value={limit} onChange={(event) => setLimit(event.target.value)} />
        </Field>
        <Button type="submit">Сохранить лимит</Button>
        <p className="text-sm text-[#667085]">Это лимит серверного назначения. АТС им сама не управляется, пока провайдер не подключён.</p>
      </form>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <CallReport calls={status.calls} users={crm.state.users} />
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="crm-panel px-4 py-3">
      <p className="text-xs text-[#667085]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#667085]">{hint}</p> : null}
    </article>
  );
}
