"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { allows } from "@/lib/access";
import { fullName, ROLE_LABEL } from "@/lib/labels";
import { visibleConversations } from "@/lib/metrics";
import { canSeeOrder, ordersNeedingAttention } from "@/lib/orders";
import { useCrm } from "@/lib/store";
import { formatClock } from "@/lib/time";
import { TelephonyBridge } from "./telephony-bridge";

type NavItem = { href: string; label: string; icon: IconName };

const ADMIN_NAV: NavItem[] = [
  { href: "/", label: "Панель руководителя", icon: "home" },
  // { href: "/recruitment", label: "Рекрутинг", icon: "chart" },
  { href: "/drivers", label: "Диспетчеры", icon: "users" },
  { href: "/orders", label: "Заказы", icon: "orders" },
  { href: "/chats", label: "Чаты", icon: "chat" },
  { href: "/sources", label: "Источники", icon: "source" },
  { href: "/employees", label: "Водители", icon: "users" },
  { href: "/time", label: "Рабочее время", icon: "clock" },
  { href: "/analytics", label: "Аналитика", icon: "chart" },
  { href: "/audit", label: "Журнал", icon: "list" },
  { href: "/telephony", label: "Телефония", icon: "phone" },
];

const DISPATCHER_NAV: NavItem[] = [
  { href: "/", label: "Рабочее место диспетчера", icon: "home" },
  { href: "/drivers", label: "Водители", icon: "users" },
  { href: "/orders", label: "Заказы", icon: "orders" },
  { href: "/chats", label: "Чаты", icon: "chat" },
  { href: "/time", label: "Рабочее время", icon: "clock" },
  { href: "/shifts", label: "История смен", icon: "list" },
];

const TITLES: Record<string, string> = {
  "/": "Панель администратора",
  "/orders": "Воронка",
  "/drivers": "Диспетчеры",
  // "/recruitment": "Рекрутинг",
  "/chats": "Чаты",
  "/sources": "Источники",
  "/employees": "Водители",
  "/time": "Рабочее время",
  "/analytics": "Аналитика",
  "/audit": "Журнал",
  "/telephony": "Телефония",
  "/platform": "Платформа",
  "/platform/companies": "Компании",
  "/platform/users": "Пользователи",
  "/platform/plans": "Тарифы",
  "/platform/finance": "Финансы",
  "/platform/agents": "AI-агенты",
  "/platform/integrations": "Интеграции",
  "/platform/support": "Поддержка",
  "/platform/notices": "Уведомления",
  "/platform/journal": "Журнал платформы",
  "/platform/roles": "Роли платформы",
  "/settings": "Настройки",
  "/requests": "Заявки",
  "/workspace": "Рабочее место",
  "/shifts": "История смен",
  "/profile": "Профиль",
  "/login": "Вход",
};

function DriverCardProbe({ onChange }: { onChange: (value: boolean) => void }) {
  const pathname = usePathname();
  const card = pathname === "/drivers" && Boolean(useSearchParams().get("id"));
  useEffect(() => {
    onChange(card);
  }, [card, onChange]);
  return null;
}

export function Frame({ children }: { children: React.ReactNode }) {
  const crm = useCrm();
  const pathname = usePathname();
  const [driverCard, setDriverCard] = useState(false);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const compact = useSyncExternalStore(subscribeCompact, getCompact, () => false);
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenu(false);
    setNotices(false);
    setOpen(false);
  }

  const pageTitle = pathname === "/"
    ? (!crm.actor ? "Акжол" : crm.isAdmin ? "Панель администратора" : "Рабочее место диспетчера")
    : pathname === "/drivers"
      ? (crm.isAdmin && !driverCard ? "Диспетчеры" : "Водители")
      : (TITLES[pathname] ?? "Акжол");

  useEffect(() => {
    document.title = `${pageTitle} — Akjol CRM`;
  }, [pageTitle]);

  useEffect(() => {
    if (!crm.ready) return;
    if (!crm.actor && pathname !== "/login" && pathname !== "/") router.replace("/");
    if (crm.actor && pathname === "/login") router.replace("/");
  }, [crm.actor, crm.ready, pathname, router]);

  function toggleCompact() {
    window.localStorage.setItem("akjol-sidebar-compact", compact ? "0" : "1");
    window.dispatchEvent(new Event(COMPACT_EVENT));
  }

  if (!crm.ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f7f8fa] text-sm text-[#667085]">
        Загрузка данных…
      </div>
    );
  }

  if (!crm.actor) {
    if (pathname !== "/" && pathname !== "/login") {
      return (
        <div className="grid min-h-dvh place-items-center bg-[#f7f8fa] text-sm text-[#667085]">
          Выход…
        </div>
      );
    }
    return <div className="min-h-dvh bg-[#f7f8fa]">{children}</div>;
  }

  if (pathname === "/login") {
    return <div className="min-h-dvh bg-[#f7f8fa]">{children}</div>;
  }

  if (!crm.user) return <div className="min-h-dvh bg-[#f7f8fa]">{children}</div>;
  if (pathname === "/workspace") return <>{children}</>;
  const user = crm.user;

  const nav = crm.isAdmin ? ADMIN_NAV : DISPATCHER_NAV;
  const conversations = visibleConversations(crm.state, crm.user, !crm.isAdmin);
  const unread = conversations.reduce((sum, conversation) => sum + conversation.unread, 0);
  const noticeItems = conversations.filter((conversation) => conversation.unread > 0).slice(0, 6);
  const orderAlerts = ordersNeedingAttention(crm.state.orders, crm.now)
    .filter((order) => canSeeOrder(order, user.id, allows(user.role, "orders.view_all")))
    .slice(0, 6);
  const wide = compact ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[232px_minmax(0,1fr)]";

  return (
    <div className={`h-dvh overflow-hidden bg-[#f7f8fa] md:grid ${wide}`}>
      <Suspense fallback={null}>
        <DriverCardProbe onChange={setDriverCard} />
      </Suspense>
      {open ? <button className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} aria-label="Закрыть меню" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-[#e6e8ec] bg-white md:static md:w-auto ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className={`flex h-14 items-center border-b border-[#e6e8ec] ${compact ? "justify-center px-2" : "gap-2 px-3"}`}>
          <Link href="/" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-2">
            <Image src="/mark.svg" alt="" width={22} height={22} priority />
            {compact ? null : <span className="truncate text-sm font-semibold">Akjol CRM</span>}
          </Link>
        </div>
        <nav className="flex-1 overflow-auto px-2 py-2">
          {nav.map((item) => {
            const active = crm.isAdmin && driverCard
              ? item.href === "/employees"
              : item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setOpen(false)}
                className={`mb-0.5 flex h-9 items-center gap-2 rounded-lg text-sm ${compact ? "justify-center px-0" : "px-2"} ${active ? "bg-[#e8f1fb] font-medium text-[#1d5fa7]" : "text-[#1f2933] hover:bg-[#f4f6f8]"}`}
              >
                <NavIcon name={item.icon} />
                {compact ? null : <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#e6e8ec] p-2">
          <button className={`mb-1 flex h-8 w-full items-center rounded-lg text-sm text-[#667085] hover:bg-[#f4f6f8] ${compact ? "justify-center" : "gap-2 px-2"}`} onClick={toggleCompact} type="button" title={compact ? "Развернуть меню" : "Свернуть меню"}>
            <NavIcon name={compact ? "expand" : "collapse"} />
            {compact ? null : <span>{compact ? "Развернуть" : "Свернуть"}</span>}
          </button>
          <Link href="/profile" title={fullName(crm.actor)} className={`flex items-center rounded-lg py-1 hover:bg-[#f4f6f8] ${compact ? "justify-center" : "gap-2 px-2"}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2e6db4] text-xs text-white">{crm.actor.firstName[0]}</span>
            {compact ? null : (
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{fullName(crm.actor)}</span>
                <span className="block truncate text-xs text-[#667085]">{crm.actor.login}@akjol.kg</span>
              </span>
            )}
          </Link>
          <button className="mt-1 flex h-8 w-full items-center justify-center rounded-lg border border-[#e6e8ec] text-sm hover:bg-[#f4f6f8]" onClick={() => crm.logout()} type="button" aria-label="Выйти">
            {compact ? <NavIcon name="logout" /> : "Выйти"}
          </button>
        </div>
      </aside>

      <div className="flex h-dvh min-w-0 flex-col">
        <header className="z-20 flex h-14 items-center gap-3 border-b border-[#e6e8ec] bg-white px-3">
          <button className="px-1 md:hidden" onClick={() => setOpen(true)} aria-label="Меню" type="button">Меню</button>
          <h1 className="min-w-0 truncate text-base font-semibold">{pageTitle}</h1>
          <form
            className="ml-auto hidden min-w-0 max-w-xs flex-1 sm:block"
            onSubmit={(event) => {
              event.preventDefault();
              const q = search.trim();
              router.push(q ? `/chats?q=${encodeURIComponent(q)}` : "/chats");
            }}
          >
            <input
              className="h-9 w-full rounded-lg border border-[#e6e8ec] bg-[#f7f8fa] px-3 text-sm outline-none focus:border-[#2e6db4]"
              placeholder="Поиск по чатам"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>
          <span className="hidden text-xs text-[#667085] lg:inline">{formatClock(new Date(crm.now))}</span>
          <div className="relative">
            <button className="relative h-9 rounded-lg px-2 text-sm hover:bg-[#f4f6f8]" onClick={() => { setNotices((value) => !value); setMenu(false); }} type="button">
              Уведомления
              {unread + orderAlerts.length > 0 ? <span className="ml-1 rounded bg-[#2e6db4] px-1.5 text-[11px] text-white">{unread + orderAlerts.length}</span> : null}
            </button>
            {notices ? (
              <div className="absolute right-0 z-30 mt-1 w-72 rounded-[10px] border border-[#e6e8ec] bg-white py-1 shadow-sm">
                {orderAlerts.length === 0 && noticeItems.length === 0 ? <p className="px-3 py-3 text-sm text-[#667085]">Нет новых сообщений и заказов без водителя</p> : null}
                {orderAlerts.map((order) => {
                  const customer = crm.state.customers.find((item) => item.id === order.customerId);
                  return (
                    <Link key={order.id} href={`/orders?order=${order.id}`} onClick={() => setNotices(false)} className="block px-3 py-2 hover:bg-[#f4f6f8]">
                      <span className="block text-sm font-medium">№{order.number} · {customer?.name ?? "Клиент"}</span>
                      <span className="text-xs text-[#667085]">{order.hold === "needs_admin" ? "Нужен администратор" : order.hold === "no_answer" ? "Клиент не отвечает" : order.hold === "no_driver" ? "Нет свободного водителя" : order.status === "awaiting_driver" ? "Нет водителя больше 10 минут" : "Новый заказ"}</span>
                    </Link>
                  );
                })}
                {noticeItems.map((conversation) => {
                  const customer = crm.state.customers.find((item) => item.id === conversation.customerId);
                  return (
                    <Link key={conversation.id} href={`/chats?chat=${conversation.id}`} onClick={() => setNotices(false)} className="block px-3 py-2 hover:bg-[#f4f6f8]">
                      <span className="block text-sm font-medium">{customer?.name}</span>
                      <span className="text-xs text-[#667085]">Непрочитано: {conversation.unread}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button className="flex h-9 items-center gap-2 rounded-lg px-1 hover:bg-[#f4f6f8]" onClick={() => { setMenu((value) => !value); setNotices(false); }} type="button">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2e6db4] text-xs text-white">{crm.actor.firstName[0]}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm">{fullName(crm.actor)}</span>
                <span className="block text-[11px] text-[#667085]">{ROLE_LABEL[crm.actor.role]}</span>
              </span>
            </button>
            {menu ? (
              <div className="absolute right-0 z-30 mt-1 w-44 rounded-[10px] border border-[#e6e8ec] bg-white py-1 text-sm shadow-sm">
                <Link href="/profile" className="block px-3 py-1.5 hover:bg-[#f4f6f8]" onClick={() => setMenu(false)}>Профиль</Link>
                <button className="block w-full px-3 py-1.5 text-left hover:bg-[#f4f6f8]" onClick={() => crm.logout()} type="button">Выйти</button>
              </div>
            ) : null}
          </div>
        </header>
        {crm.viewing && crm.user ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d7e6f5] bg-[#f3f8fd] px-4 py-2 text-sm text-[#1d4e89]">
            <p>Просмотр: {fullName(crm.user)}. Действия от его имени выключены.</p>
            <button className="h-8 rounded-lg bg-white px-2 text-xs text-[#1d5fa7]" onClick={() => crm.stopViewAs()} type="button">Выйти из просмотра</button>
          </div>
        ) : null}
        <TelephonyBridge />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}

const COMPACT_EVENT = "akjol-sidebar-compact";

function subscribeCompact(onStoreChange: () => void) {
  window.addEventListener(COMPACT_EVENT, onStoreChange);
  return () => window.removeEventListener(COMPACT_EVENT, onStoreChange);
}

function getCompact() {
  return window.localStorage.getItem("akjol-sidebar-compact") === "1";
}

type IconName = "home" | "chat" | "inbox" | "source" | "users" | "clock" | "chart" | "list" | "collapse" | "expand" | "logout" | "orders" | "phone";

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z",
    orders: "M7 3h10a1 1 0 0 1 1 1v16l-2-1.2L14 20l-2-1.2L10 20l-2-1.2L6 20V4a1 1 0 0 1 1-1Zm2 5h6M9 12h6",
    chat: "M5 6h14v9H8l-3 3V6Z",
    inbox: "M4 7h16v11H4V7Zm0 4h4l1.5 2h5L16 11h4",
    source: "M5 6h14M7 12h10M9 18h6",
    users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5M4 19c.4-2.4 2.4-4 5-4s4.6 1.6 5 4m2-3c1.8.3 3.2 1.6 3.5 3",
    clock: "M12 7v5l3 2M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
    chart: "M5 19V5M5 19h14M8 16v-4m4 4V8m4 8v-6",
    list: "M8 7h11M8 12h11M8 17h11M5 7h.01M5 12h.01M5 17h.01",
    collapse: "M15 6 9 12l6 6",
    expand: "M9 6l6 6-6 6",
    logout: "M10 7V5h8v14h-8v-2M5 12h9M8 9l-3 3 3 3",
    phone: "M8 3h3l1 4-2 1a11 11 0 0 0 6 6l1-2 4 1v3a2 2 0 0 1-2 2A15 15 0 0 1 6 5a2 2 0 0 1 2-2Z",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}
