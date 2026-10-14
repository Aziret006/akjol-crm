"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NoAccess } from "@/components/ui";
import { PlatformProvider, usePlatform } from "@/lib/platform/client";
import { PLATFORM_ROLE_LABEL } from "@/lib/platform/labels";
import { useCrm } from "@/lib/store";

const NAV = [
  { href: "/platform", label: "Обзор" },
  { href: "/platform/companies", label: "Компании" },
  { href: "/platform/users", label: "Пользователи" },
  { href: "/platform/plans", label: "Тарифы" },
  { href: "/platform/finance", label: "Финансы" },
  { href: "/platform/agents", label: "AI-агенты" },
  { href: "/platform/integrations", label: "Интеграции" },
  { href: "/platform/support", label: "Поддержка" },
  { href: "/platform/notices", label: "Уведомления" },
  { href: "/platform/journal", label: "Журнал" },
  { href: "/platform/roles", label: "Роли" },
];

export function PlatformShell({ children }: { children: ReactNode }) {
  const crm = useCrm();
  if (!crm.ready) return <p className="text-sm text-[#667085]">Загрузка…</p>;
  if (!crm.isAdmin) return <NoAccess />;
  return <PlatformProvider><PlatformChrome>{children}</PlatformChrome></PlatformProvider>;
}

function PlatformChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const platform = usePlatform();
  if (!platform.ready) return <p className="text-sm text-[#667085]">Загрузка панели платформы…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Панель платформы</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Внутреннее управление арендаторами. Данные помечены как демо и лежат в `.data/platform.json`, отдельно от заказов таксопарка.
            {` · ${PLATFORM_ROLE_LABEL[platform.role]}`}
          </p>
        </div>
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-[#e6e8ec] px-1">
        {NAV.map((item) => {
          const active = item.href === "/platform" ? pathname === "/platform" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`h-9 shrink-0 px-3 text-sm whitespace-nowrap ${active ? "border-b-2 border-[#2e6db4] font-semibold text-[#1d5fa7]" : "text-[#52606d] hover:text-[#1f2933]"}`}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {platform.error ? <p className="text-sm text-[#b42318]">{platform.error}</p> : null}
      {children}
    </div>
  );
}
