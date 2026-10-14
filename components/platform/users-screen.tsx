"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, controlClass } from "@/components/ui";
import { platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { formatDateTime } from "@/lib/time";
import { Confirm, EmptyBox, Pager, Pill } from "./widgets";

const PAGE = 8;

export function UsersScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const { state, role, run } = usePlatform();
  const [query, setQuery] = useState("");
  const [companyId, setCompanyId] = useState("all");
  const [account, setAccount] = useState<"all" | "active" | "blocked">("all");
  const [sort, setSort] = useState<"name" | "seen">("name");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<null | { kind: "block" | "restore" | "revoke" }>(null);
  const [roleDraft, setRoleDraft] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  if (!platformAllows(role, "users.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;
  const selected = state.users.find((item) => item.id === id) ?? null;

  if (selected) {
    const company = state.companies.find((item) => item.id === selected.companyId);
    const canEdit = platformAllows(role, "users.edit");
    const log = state.journal.filter((item) => item.object.includes(selected.name) || item.object.includes(selected.email));
    return (
      <div className="space-y-3">
        <Link href="/platform/users" className="text-sm text-[#1d5fa7]">← Все пользователи</Link>
        {message ? <p className={`text-sm ${message === "Роль сохранена" || message === "Сохранено" ? "text-[#1f7a45]" : "text-[#b42318]"}`}>{message}</p> : null}
        <section className="crm-panel p-4">
          <h3 className="text-lg font-semibold">{selected.name}</h3>
          <p className="text-sm text-[#667085]">{selected.email} · {selected.phone || "телефон не указан"}</p>
          <p className="mt-2 text-sm">Компания: <Link href={`/platform/companies?id=${selected.companyId}`} className="text-[#1d5fa7]">{company?.name}</Link></p>
          <p className="text-sm">Роль в компании: {selected.role}</p>
          <p className="text-sm">Регистрация {formatDateTime(selected.createdAt)} · последний вход {selected.lastSeenAt ? formatDateTime(selected.lastSeenAt) : "нет данных"}</p>
          <p className="mt-2"><Pill text={selected.accountStatus === "active" ? "Активен" : "Заблокирован"} tone={selected.accountStatus === "active" ? "green" : "rose"} /></p>
          <p className="mt-3 text-xs text-[#98a2b3]">Пароли, токены и секреты не показываются.</p>
          {canEdit ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {selected.accountStatus === "active" ? <Button variant="danger" onClick={() => setConfirm({ kind: "block" })}>Заблокировать</Button> : <Button onClick={() => setConfirm({ kind: "restore" })}>Восстановить</Button>}
                <Button variant="secondary" onClick={() => setConfirm({ kind: "revoke" })}>Отозвать сессии</Button>
              </div>
              <form className="flex flex-wrap items-end gap-2" onSubmit={async (event) => { event.preventDefault(); const result = await run({ type: "set-user-role", userId: selected.id, role: roleDraft, reason }); setMessage(result.ok ? "Роль сохранена" : result.error); }}>
                <Field label="Роль в компании">
                  <input className={controlClass} value={roleDraft} onChange={(event) => setRoleDraft(event.target.value)} placeholder={selected.role} />
                </Field>
                <Field label="Причина">
                  <input className={controlClass} value={reason} onChange={(event) => setReason(event.target.value)} required />
                </Field>
                <Button type="submit" disabled={roleDraft.trim().length < 2 || reason.trim().length < 3}>Сменить роль</Button>
              </form>
            </div>
          ) : null}
        </section>
        <section className="crm-panel">
          <h3 className="px-4 py-3 font-semibold">История действий</h3>
          {log.length === 0 ? <EmptyBox>Записей нет</EmptyBox> : log.map((item) => <p key={item.id} className="border-t border-[#e6e8ec] px-4 py-2 text-sm">{formatDateTime(item.at)} · {item.action} · {item.reason}</p>)}
        </section>
        {confirm ? (
          <Confirm
            title={confirm.kind === "revoke" ? "Отозвать сессии?" : confirm.kind === "block" ? "Заблокировать доступ?" : "Восстановить доступ?"}
            text={confirm.kind === "revoke" ? "Если сервер сессий не подключён, операция будет отклонена." : "Потребуется причина. Пароль не меняется и не показывается."}
            confirmLabel="Подтвердить"
            onClose={() => setConfirm(null)}
            onConfirm={async (why) => {
              const result = confirm.kind === "revoke"
                ? await run({ type: "revoke-sessions", userId: selected.id })
                : await run({ type: "set-user-status", userId: selected.id, accountStatus: confirm.kind === "block" ? "blocked" : "active", reason: why });
              setMessage(result.ok ? "Сохранено" : result.error);
              setConfirm(null);
            }}
          />
        ) : null}
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const rows = state.users.filter((item) => {
    if (companyId !== "all" && item.companyId !== companyId) return false;
    if (account !== "all" && item.accountStatus !== account) return false;
    if (needle && !`${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(needle)) return false;
    return true;
  }).sort((a, b) => sort === "seen" ? (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "") : a.name.localeCompare(b.name, "ru"));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className={`${controlClass} max-w-xs`} placeholder="Имя, email, телефон" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        <select className={`${controlClass} w-auto`} value={companyId} onChange={(event) => { setCompanyId(event.target.value); setPage(1); }}>
          <option value="all">Все компании</option>
          {state.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className={`${controlClass} w-auto`} value={account} onChange={(event) => { setAccount(event.target.value as typeof account); setPage(1); }}>
          <option value="all">Все статусы</option>
          <option value="active">Активны</option>
          <option value="blocked">Заблокированы</option>
        </select>
        <select className={`${controlClass} w-auto`} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <option value="name">По имени</option>
          <option value="seen">По последнему входу</option>
        </select>
      </div>
      <section className="crm-panel overflow-x-auto">
        {slice.length === 0 ? <EmptyBox>Пользователей нет</EmptyBox> : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["Имя", "Email", "Телефон", "Компания", "Роль", "Регистрация", "Вход", "Статус"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {slice.map((item) => {
                const company = state.companies.find((row) => row.id === item.companyId);
                return (
                  <tr key={item.id} className="border-t border-[#e6e8ec]">
                    <td className="px-3 py-2"><Link className="text-[#1d5fa7]" href={`/platform/users?id=${item.id}`}>{item.name}</Link></td>
                    <td className="px-3 py-2">{item.email}</td>
                    <td className="px-3 py-2">{item.phone || "—"}</td>
                    <td className="px-3 py-2">{company?.name}</td>
                    <td className="px-3 py-2">{item.role}</td>
                    <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
                    <td className="px-3 py-2">{item.lastSeenAt ? formatDateTime(item.lastSeenAt) : "—"}</td>
                    <td className="px-3 py-2"><Pill text={item.accountStatus === "active" ? "Активен" : "Блок"} tone={item.accountStatus === "active" ? "green" : "rose"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pager page={page} pages={pages} onPage={setPage} />
      </section>
    </div>
  );
}
