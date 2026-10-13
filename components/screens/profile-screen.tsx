"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { summarizeDate } from "@/lib/attendance";
import { ACCOUNT_LABEL, EVENT_LABEL, ROLE_LABEL, fullName } from "@/lib/labels";
import { useCrm } from "@/lib/store";
import { bishkekDateString, formatDate, formatDuration, formatTime } from "@/lib/time";
import type { User } from "@/lib/types";
import { AccountBadge, Button, Empty, ErrorText, Field, WorkBadge, controlClass } from "../ui";

type TabId = "data" | "shift" | "access";

export function ProfileScreen() {
  const crm = useCrm();
  const params = useSearchParams();
  const requested = params.get("user");
  const user = crm.isAdmin && requested
    ? crm.state.users.find((item) => item.id === requested) ?? null
    : crm.user;
  const [tab, setTab] = useState<TabId>("data");
  const [tabUserId, setTabUserId] = useState(user?.id);
  if (tabUserId !== user?.id) {
    setTabUserId(user?.id);
    setTab("data");
  }

  if (!crm.user) return null;
  if (!user) return <Empty title="Сотрудник не найден" text="Запись удалена или ссылка устарела." />;

  const tabs: { id: TabId; label: string }[] = user.role === "dispatcher"
    ? [
        { id: "data", label: "Данные" },
        { id: "shift", label: "Смена" },
      ]
    : [
        { id: "data", label: "Данные" },
        { id: "access", label: "Доступ" },
      ];
  const active = tabs.some((item) => item.id === tab) ? tab : "data";
  const own = crm.actor?.id === user.id && !crm.viewing;

  return (
    <section className="crm-panel max-w-3xl">
      <div className="flex items-center gap-3 px-3 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2e6db4] text-sm text-white">{user.firstName[0]}</span>
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{fullName(user)}</h2>
          <p className="text-[13px] text-[#828b95]">{ROLE_LABEL[user.role]} · {user.login}</p>
        </div>
        <div className="ml-auto"><AccountBadge status={user.accountStatus} /></div>
      </div>
      <div className="flex gap-1 border-t border-[#eef1f4] px-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`h-9 border-b-2 px-3 text-[13px] ${active === item.id ? "border-[#2e6db4] font-medium text-[#1d5fa7]" : "border-transparent text-[#525c69] hover:text-[#333]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="border-t border-[#eef1f4] px-3 py-3">
        {active === "data" ? <DataTab user={user} own={own} /> : null}
        {active === "shift" ? <ShiftTab user={user} /> : null}
        {active === "access" ? <AccessTab user={user} own={own} /> : null}
      </div>
    </section>
  );
}

function DataTab({ user, own }: { user: User; own: boolean }) {
  const rows = [
    ["Имя", fullName(user)],
    ["Логин", user.login],
    ["Роль", ROLE_LABEL[user.role]],
    ["Аккаунт", ACCOUNT_LABEL[user.accountStatus]],
    ...(user.role === "dispatcher" ? [["График", user.scheduleStart ?? "—"]] : []),
    ["В системе с", formatDate(user.createdAt)],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-[#828b95]">{label}</dt>
            <dd className="mt-0.5 text-[13px]">{value}</dd>
          </div>
        ))}
      </dl>
      {user.role === "dispatcher" ? <DispatcherActions user={user} /> : null}
      {own && user.role === "dispatcher" ? <PasswordForm /> : null}
    </div>
  );
}

function ShiftTab({ user }: { user: User }) {
  const crm = useCrm();
  const today = bishkekDateString(new Date(crm.now));
  const summary = summarizeDate(crm.state.events, user.id, today, crm.now, user.scheduleStart);
  const rows = [
    ["Статус", <WorkBadge key="status" status={summary.status} />],
    ["Пришёл", summary.arrivedAt ? formatTime(summary.arrivedAt) : "—"],
    ["Отошёл", summary.lastAwayAt ? formatTime(summary.lastAwayAt) : "—"],
    ["Вернулся", summary.lastReturnAt ? formatTime(summary.lastReturnAt) : "—"],
    ["Закончил", summary.finishedAt ? formatTime(summary.finishedAt) : "—"],
    ["Рабочие часы", summary.events.length ? formatDuration(summary.workedMs) : "—"],
  ] as const;

  return (
    <div className="space-y-3">
      <dl className="grid gap-3 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-[#828b95]">{label}</dt>
            <dd className="mt-0.5 text-[13px]">{value}</dd>
          </div>
        ))}
      </dl>
      {summary.events.length === 0 ? <p className="text-[13px] text-[#828b95]">Сегодня отметок нет</p> : (
        <table className="w-full text-left">
          <thead className="text-[#525c69]">
            <tr>
              <th className="py-1 font-medium">Событие</th>
              <th className="py-1 font-medium">Время</th>
            </tr>
          </thead>
          <tbody>
            {summary.events.map((event) => (
              <tr key={event.id} className="border-t border-[#eef1f4]">
                <td className="py-1.5 text-[13px]">{EVENT_LABEL[event.type]}</td>
                <td className="py-1.5 text-[13px] tabular-nums">{formatTime(event.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AccessTab({ user, own }: { user: User; own: boolean }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[#828b95]">Роль</dt>
          <dd className="mt-0.5 text-[13px]">{ROLE_LABEL[user.role]}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#828b95]">Аккаунт</dt>
          <dd className="mt-0.5"><AccountBadge status={user.accountStatus} /></dd>
        </div>
      </dl>
      {own ? <PasswordForm /> : <AdminActions user={user} />}
    </div>
  );
}

function DispatcherActions({ user }: { user: User }) {
  const crm = useCrm();
  const router = useRouter();
  const [error, setError] = useState("");
  if (!crm.isAdmin || user.id === crm.actor?.id) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-[#eef1f4] pt-3">
        <Link className="crm-link" href="/chats">Чаты</Link>
        <Link className="crm-link" href="/time">Рабочее время</Link>
      </div>
    );
  }
  const nextRole = user.role === "admin" ? "dispatcher" : "admin";
  const nextStatus = user.accountStatus === "blocked" ? "active" : "blocked";

  return (
    <div className="space-y-2 border-t border-[#eef1f4] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link className="crm-link" href={`/chats?employee=${user.id}`}>Чаты</Link>
        <Link className="crm-link" href="/time">Рабочее время</Link>
        <button
          className="crm-link"
          type="button"
          onClick={() => {
            const result = crm.viewAs(user.id);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/");
          }}
        >
          Открыть интерфейс
        </button>
        <Button variant="secondary" onClick={() => { const result = crm.setRole(user.id, nextRole); if (!result.ok) setError(result.error); }}>
          {nextRole === "admin" ? "Сделать администратором" : "Сделать диспетчером"}
        </Button>
        <Button variant={nextStatus === "blocked" ? "danger" : "secondary"} onClick={() => { const result = crm.setAccountStatus(user.id, nextStatus); if (!result.ok) setError(result.error); }}>
          {nextStatus === "blocked" ? "Заблокировать" : "Активировать"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function AdminActions({ user }: { user: User }) {
  const crm = useCrm();
  const [error, setError] = useState("");
  if (user.id === crm.actor?.id) return null;
  const nextRole = user.role === "admin" ? "dispatcher" : "admin";
  const nextStatus = user.accountStatus === "blocked" ? "active" : "blocked";

  return (
    <div className="space-y-2 border-t border-[#eef1f4] pt-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const result = crm.setRole(user.id, nextRole);
            if (!result.ok) setError(result.error);
          }}
        >
          {nextRole === "admin" ? "Сделать администратором" : "Сделать диспетчером"}
        </Button>
        <Button
          variant={nextStatus === "blocked" ? "danger" : "secondary"}
          onClick={() => {
            const result = crm.setAccountStatus(user.id, nextStatus);
            if (!result.ok) setError(result.error);
          }}
        >
          {nextStatus === "blocked" ? "Заблокировать" : "Активировать"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function PasswordForm() {
  const crm = useCrm();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  return (
    <form
      className="grid max-w-sm gap-2 border-t border-[#eef1f4] pt-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setDone(false);
        if (nextPassword !== again) {
          setError("Пароли не совпадают");
          return;
        }
        const result = await crm.changePassword(currentPassword, nextPassword);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setCurrentPassword("");
        setNextPassword("");
        setAgain("");
        setError("");
        setDone(true);
      }}
    >
      <Field label="Текущий пароль">
        <input className={controlClass} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
      </Field>
      <Field label="Новый пароль">
        <input className={controlClass} type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} autoComplete="new-password" required />
      </Field>
      <Field label="Ещё раз">
        <input className={controlClass} type="password" value={again} onChange={(event) => setAgain(event.target.value)} autoComplete="new-password" required />
      </Field>
      <ErrorText>{error}</ErrorText>
      {done ? <p className="text-[13px] text-[#1f7a45]">Пароль сохранён</p> : null}
      <div><Button type="submit">Сменить пароль</Button></div>
    </form>
  );
}
