"use client";

import { useEffect } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ACCOUNT_LABEL, STATUS_LABEL, WORK_LABEL } from "@/lib/labels";
import type { AccountStatus, RequestStatus, WorkStatus } from "@/lib/types";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "dark" }) {
  const styles = {
    primary: "bg-[#2e6db4] text-white hover:bg-[#245a96]",
    secondary: "border border-[#d5dde5] bg-white text-[#333] hover:bg-[#f5f8fb]",
    ghost: "text-[#333] hover:bg-[#eef2f4]",
    danger: "border border-[#e6c3c3] bg-white text-[#b42318] hover:bg-[#fdf2f2]",
    dark: "bg-[#333] text-white hover:bg-[#1f1f1f]",
  }[variant];
  return (
    <button
      className={`inline-flex h-8 items-center justify-center gap-2 rounded px-3 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:bg-[#e8edf2] disabled:text-[#9aa3ad] ${styles} ${className}`}
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
      <span className="text-[#525c69]">{label}</span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-8 w-full rounded border border-[#cfd6dd] bg-white px-2 text-[13px] outline-none focus:border-[#2e6db4]";

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
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded border border-[#e3e8ee] bg-white p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="rounded-lg px-2 py-1 text-sm text-[#6b6560] hover:bg-black/5" onClick={onClose} type="button">
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

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded border border-dashed border-[#d5dde5] bg-white px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[#6b6560]">{text}</p>
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
  return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="crm-panel px-3 py-2.5">
      <p className="text-xs text-[#828b95]">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-none text-[#333]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#828b95]">{hint}</p> : null}
    </article>
  );
}
