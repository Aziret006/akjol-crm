"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { summarizeDate } from "@/lib/attendance";
import { ROLE_LABEL, fullName } from "@/lib/labels";
import { handledToday } from "@/lib/metrics";
import { useCrm, type UserInput } from "@/lib/store";
import { bishkekDateString, formatDate, formatDuration, formatTime } from "@/lib/time";
import type { AccountStatus, Role } from "@/lib/types";
import { AccountBadge, Button, Empty, ErrorText, Field, Modal, NoAccess, WorkBadge, controlClass } from "../ui";

const emptyForm = {
  firstName: "",
  lastName: "",
  login: "",
  password: "",
  role: "dispatcher" as Role,
  accountStatus: "active" as AccountStatus,
  scheduleStart: "09:00",
};

export function EmployeesScreen() {
  const crm = useCrm();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<UserInput | null>(null);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return crm.state.users.filter((user) => {
      const haystack = `${fullName(user)} ${user.login}`.toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [crm.state.users, query]);

  if (!crm.isAdmin) return <NoAccess />;

  const today = bishkekDateString(new Date(crm.now));

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className={`${controlClass} max-w-sm`} placeholder="Поиск по имени или логину" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button onClick={() => { setError(""); setForm({ ...emptyForm }); }}>Добавить сотрудника</Button>
      </div>
      {rows.length === 0 ? <Empty title="Сотрудники не найдены" text="Измените поиск или добавьте сотрудника." /> : (
        <div className="overflow-x-auto crm-panel">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>
                {["Сотрудник", "Логин", "Роль", "Аккаунт", "Смена", "Приход сегодня", "Время сегодня", "Обработано", "Создан", ""].map((title) => (
                  <th key={title} className="px-3 py-3 font-medium">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const summary = summarizeDate(crm.state.events, user.id, today, crm.now, user.scheduleStart);
                return (
                  <tr key={user.id} className="border-t border-[#e8eaee]">
                    <td className="px-3 py-3 font-medium">{fullName(user)}</td>
                    <td className="px-3 py-3">{user.login}</td>
                    <td className="px-3 py-3">{ROLE_LABEL[user.role]}</td>
                    <td className="px-3 py-3"><AccountBadge status={user.accountStatus} /></td>
                    <td className="px-3 py-3"><WorkBadge status={summary.status} /></td>
                    <td className="px-3 py-3">{summary.arrivedAt ? formatTime(summary.arrivedAt) : "—"}</td>
                    <td className="px-3 py-3">{formatDuration(summary.workedMs)}</td>
                    <td className="px-3 py-3">{handledToday(crm.state, user.id, crm.now)}</td>
                    <td className="px-3 py-3">{formatDate(user.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Link className="crm-link" href={`/profile?user=${user.id}`}>Профиль</Link>
                      <button
                        className="crm-link ml-3"
                        type="button"
                        onClick={() => {
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
                        }}
                      >
                        Изменить
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form ? (
        <Modal title={form.id ? "Редактировать сотрудника" : "Новый сотрудник"} onClose={() => setForm(null)}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <Field label="Имя"><input className={controlClass} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></Field>
            <Field label="Фамилия"><input className={controlClass} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></Field>
            <Field label="Логин"><input className={controlClass} value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} required /></Field>
            <Field label={form.id ? "Новый пароль" : "Пароль"}><input className={controlClass} type="password" value={form.password ?? ""} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={form.id ? "Оставьте пустым, чтобы не менять" : ""} /></Field>
            <Field label="Роль">
              <select className={controlClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                <option value="dispatcher">Диспетчер</option>
                <option value="admin">Администратор</option>
              </select>
            </Field>
            <Field label="Статус аккаунта">
              <select className={controlClass} value={form.accountStatus} onChange={(event) => setForm({ ...form, accountStatus: event.target.value as AccountStatus })}>
                <option value="active">Активен</option>
                <option value="blocked">Заблокирован</option>
              </select>
            </Field>
            <Field label="Начало графика">
              <input className={controlClass} type="time" value={form.scheduleStart ?? ""} onChange={(event) => setForm({ ...form, scheduleStart: event.target.value || null })} />
            </Field>
            <div className="sm:col-span-2 space-y-3">
              <ErrorText>{error}</ErrorText>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </Modal>
      ) : null}

    </div>
  );
}
