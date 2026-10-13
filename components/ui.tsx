"use client";

import { useEffect } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ACCOUNT_LABEL, DRIVER_DUTY_LABEL, ORDER_STATUS_LABEL, STATUS_LABEL, WORK_LABEL } from "@/lib/labels";
import type { AccountStatus, DriverDuty, OrderStatus, RequestStatus, WorkStatus } from "@/lib/types";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "dark" }) {
  const styles = {
    primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
    secondary: "border border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-[#f4f6f8]",
    ghost: "text-[var(--foreground)] hover:bg-[#eef1f4]",
    danger: "border border-[#f0d0d0] bg-white text-[#b42318] hover:bg-[#fdf6f6]",
    dark: "bg-[#243140] text-white hover:bg-[#1b2836]",
  }[variant];
  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:bg-[#e8edf2] disabled:text-[#98a2b3] ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-[10px] border border-[var(--line)] bg-white p-4 shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="rounded-lg px-2 py-1 text-sm text-[#667085] hover:bg-black/5" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function WorkBadge({ status }: { status: WorkStatus }) {
  const tone = {
    working: "bg-[#e7f6ee] text-[#1f7a45]",
    away: "bg-[#fff4d6] text-[#8a5a00]",
    finished: "bg-[#eef1f4] text-[#525c69]",
    idle: "bg-[#f4f6f8] text-[#828b95]",
  }[status];
  return <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${tone}`}><Dot status={status} />{WORK_LABEL[status]}</span>;
}

export function Dot({ status }: { status: WorkStatus }) {
  const color = {
    working: "bg-emerald-500",
    away: "bg-[#e3a008]",
    finished: "bg-[#8a847c]",
    idle: "bg-[#d0cbc3]",
  }[status];
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

export function AccountBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${status === "active" ? "bg-[#e7f6ee] text-[#1f7a45]" : "bg-[#fdecec] text-[#b42318]"}`}>
      {ACCOUNT_LABEL[status]}
    </span>
  );
}

export function RequestBadge({ status }: { status: RequestStatus }) {
  const tone = {
    new: "bg-[#fff4d6] text-[#8a5a00]",
    in_progress: "bg-[#e7f1fb] text-[#1d5fa7]",
    waiting: "bg-[#fff0e6] text-[#b45309]",
    done: "bg-[#eef1f4] text-[#525c69]",
  }[status];
  return <span className={`rounded px-1.5 py-0.5 text-xs ${tone}`}>{STATUS_LABEL[status]}</span>;
}

export function OrderBadge({ status }: { status: OrderStatus }) {
  const tone = {
    new: "bg-[#fff4d6] text-[#8a5a00]",
    processing: "bg-[#e7f1fb] text-[#1d5fa7]",
    awaiting_driver: "bg-[#fff0e6] text-[#b45309]",
    assigned: "bg-[#e8f1fb] text-[#1d5fa7]",
    en_route: "bg-[#e7f6ee] text-[#1f7a45]",
    in_progress: "bg-[#e3f6ef] text-[#157347]",
    done: "bg-[#eef1f4] text-[#525c69]",
    cancelled: "bg-[#fdecec] text-[#b42318]",
  }[status];
  return <span className={`rounded px-1.5 py-0.5 text-xs ${tone}`}>{ORDER_STATUS_LABEL[status]}</span>;
}

export function DutyBadge({ duty }: { duty: DriverDuty }) {
  const tone = {
    available: "bg-[#e7f6ee] text-[#1f7a45]",
    busy: "bg-[#fff4d6] text-[#8a5a00]",
    offline: "bg-[#eef1f4] text-[#525c69]",
  }[duty];
  return <span className={`rounded px-1.5 py-0.5 text-xs ${tone}`}>{DRIVER_DUTY_LABEL[duty]}</span>;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--line)] bg-white px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}

export function NoAccess() {
  return (
    <Empty
      title="Этот раздел недоступен"
      text="У вашей роли нет прав на просмотр. Если вы в режиме просмотра сотрудника, выйдите из него."
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-[#fdf2f2] px-3 py-2 text-sm text-[#b42318]">{children}</p>;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="crm-panel px-4 py-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none tracking-tight">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-[var(--muted)]">{hint}</p> : null}
    </article>
  );
}
