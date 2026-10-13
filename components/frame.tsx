"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fullName, ROLE_LABEL } from "@/lib/labels";
import { visibleConversations } from "@/lib/metrics";
import { useCrm } from "@/lib/store";
import { formatClock } from "@/lib/time";

const ADMIN_NAV = [
  { href: "/", label: "Рабочий стол" },
  { href: "/chats", label: "Чаты" },
  { href: "/sources", label: "Источники" },
  { href: "/employees", label: "Сотрудники" },
  { href: "/time", label: "Рабочее время" },
  { href: "/analytics", label: "Аналитика" },
  { href: "/audit", label: "Журнал" },
  { href: "/settings", label: "Настройки" },
  { href: "/profile", label: "Профиль" },
];

const DISPATCHER_NAV = [
  { href: "/", label: "Рабочий стол" },
  { href: "/chats", label: "Чаты" },
  { href: "/requests", label: "Мои обращения" },
  { href: "/time", label: "Рабочее время" },
  { href: "/shifts", label: "История смен" },
  { href: "/profile", label: "Профиль" },
];

const TITLES: Record<string, string> = {
  "/": "Рабочий стол",
  "/chats": "Чаты",
  "/sources": "Источники",
  "/employees": "Сотрудники",
  "/time": "Рабочее время",
  "/analytics": "Аналитика",
  "/audit": "Журнал",
  "/settings": "Настройки",
  "/requests": "Мои обращения",
  "/shifts": "История смен",
  "/profile": "Профиль",
  "/login": "Вход",
};

export function Frame({ children }: { children: React.ReactNode }) {
  const crm = useCrm();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    document.title = `${TITLES[pathname] ?? "Акжол"} — Акжол CRM`;
    setMenu(false);
    setNotices(false);
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!crm.ready) return;
    if (!crm.actor && pathname !== "/login" && pathname !== "/") router.replace("/");
    if (crm.actor && pathname === "/login") router.replace("/");
  }, [crm.actor, crm.ready, pathname, router]);

  if (!crm.ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#eef2f4] text-sm text-[#828b95]">
        Загрузка...
      </div>
    );
  }

  if (!crm.actor) {
    if (pathname !== "/" && pathname !== "/login") return null;
    return <div className="min-h-dvh bg-[#eef2f4]">{children}</div>;
  }

  if (pathname === "/login") {
    return <div className="min-h-dvh bg-[#eef2f4]">{children}</div>;
  }

  if (!crm.user) return <div className="min-h-dvh bg-[#eef2f4]">{children}</div>;

  const nav = crm.isAdmin ? ADMIN_NAV : DISPATCHER_NAV;
  const conversations = visibleConversations(crm.state, crm.user, !crm.isAdmin);
  const unread = conversations.reduce((sum, conversation) => sum + conversation.unread, 0);
  const noticeItems = conversations.filter((conversation) => conversation.unread > 0).slice(0, 6);

  return (
    <div className="h-dvh overflow-hidden bg-[#eef2f4] md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      {open ? <button className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} aria-label="Закрыть меню" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-[#e3e8ee] bg-white md:static ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex h-12 items-center border-b border-[#eef1f4] px-3">
          <Link href="/" onClick={() => setOpen(false)}>
            <Image src="/logo.svg" alt="Акжол" width={118} height={23} priority />
          </Link>
        </div>
        <nav className="flex-1 overflow-auto px-2 py-2">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`mb-0.5 flex h-8 items-center rounded px-2 text-[13px] ${active ? "bg-[#e8f2fc] font-medium text-[#1d5fa7]" : "text-[#333] hover:bg-[#f4f7f9]"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#eef1f4] p-2">
          <div className="px-2 py-1">
            <p className="truncate text-[13px] font-medium">{fullName(crm.actor)}</p>
            <p className="truncate text-[12px] text-[#828b95]">{crm.actor.login}@akjol.kg</p>
          </div>
          <button className="mt-1 h-8 w-full rounded border border-[#d5dde5] text-[13px] hover:bg-[#f5f8fb]" onClick={() => crm.logout()} type="button">
            Выйти
          </button>
        </div>
      </aside>

      <div className="flex h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-[#e3e8ee] bg-white px-3">
          <button className="px-1 md:hidden" onClick={() => setOpen(true)} aria-label="Меню" type="button">Меню</button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{TITLES[pathname] ?? "Акжол"}</h1>
          <span className="hidden text-xs text-[#828b95] sm:inline">{formatClock(new Date(crm.now))}</span>
          <div className="relative">
            <button className="relative h-8 rounded px-2 text-[13px] hover:bg-[#f4f7f9]" onClick={() => { setNotices((value) => !value); setMenu(false); }} type="button">
              Уведомления
              {unread > 0 ? <span className="ml-1 rounded bg-[#2e6db4] px-1 text-[11px] text-white">{unread}</span> : null}
            </button>
            {notices ? (
              <div className="absolute right-0 z-30 mt-1 w-72 rounded border border-[#e3e8ee] bg-white py-1 shadow-lg">
                {noticeItems.length === 0 ? <p className="px-3 py-3 text-[#828b95]">Новых сообщений нет</p> : noticeItems.map((conversation) => {
                  const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
                  return (
                    <Link key={conversation.id} href={`/chats?chat=${conversation.id}`} onClick={() => setNotices(false)} className="block px-3 py-2 hover:bg-[#f4f7f9]">
                      <span className="block font-medium">{customer?.name}</span>
                      <span className="text-xs text-[#828b95]">Непрочитано: {conversation.unread}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button className="flex h-8 items-center gap-2 rounded px-1 hover:bg-[#f4f7f9]" onClick={() => { setMenu((value) => !value); setNotices(false); }} type="button">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2e6db4] text-[11px] text-white">{crm.actor.firstName[0]}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[13px]">{fullName(crm.actor)}</span>
                <span className="block text-[11px] text-[#828b95]">{ROLE_LABEL[crm.actor.role]}</span>
              </span>
            </button>
            {menu ? (
              <div className="absolute right-0 z-30 mt-1 w-44 rounded border border-[#e3e8ee] bg-white py-1 text-[13px] shadow-lg">
                <Link href="/profile" className="block px-3 py-1.5 hover:bg-[#f4f7f9]" onClick={() => setMenu(false)}>Профиль</Link>
                <button className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f7f9]" onClick={() => crm.logout()} type="button">Выйти</button>
              </div>
            ) : null}
          </div>
        </header>
        {crm.viewing && crm.user ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c9dff3] bg-[#e8f3fc] px-3 py-2 text-[13px] text-[#1d4e89]">
            <p>Просмотр интерфейса: {fullName(crm.user)}. Пароль не запрашивается, действия от его имени выключены.</p>
            <button className="h-7 rounded bg-white px-2 text-xs text-[#1d5fa7]" onClick={() => crm.stopViewAs()} type="button">Выйти из просмотра</button>
          </div>
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3">{children}</main>
      </div>
    </div>
  );
}
