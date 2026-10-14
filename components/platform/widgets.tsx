"use client";

import { useState, type ReactNode } from "react";
import { Button, Modal, controlClass } from "@/components/ui";

export function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <article className="crm-panel px-4 py-3">
      <p className="text-sm text-[#667085]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#98a2b3]">{hint}</p> : null}
    </article>
  );
}

export function Pill({ text, tone = "gray" }: { text: string; tone?: "gray" | "green" | "amber" | "rose" | "blue" }) {
  const look = {
    gray: "bg-[#f4f6f8] text-[#52606d]",
    green: "bg-[#e7f6ee] text-[#1f7a45]",
    amber: "bg-[#fff4e5] text-[#c05621]",
    rose: "bg-[#fdecec] text-[#c24141]",
    blue: "bg-[#e8f1fb] text-[#1d5fa7]",
  }[tone];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${look}`}>{text}</span>;
}

export function Confirm({
  title,
  text,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-[#52606d]">{text}</p>
      <label className="mt-3 block text-sm">
        <span className="text-[#667085]">Причина</span>
        <input className={`${controlClass} mt-1`} value={reason} onChange={(event) => setReason(event.target.value)} required />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
        <Button type="button" disabled={reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function Spark({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    return `${x},${100 - (value / max) * 100}`;
  }).join(" ");
  return (
    <div className="crm-panel p-4">
      <h3 className="text-sm font-semibold">{label}</h3>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-3 h-24 w-full" role="img" aria-label={label}>
        <polyline points={points} fill="none" stroke="#2e6db4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-2 text-xs text-[#98a2b3]">По демо-записям за выбранный период. Нуль — записей не было.</p>
    </div>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-2 text-sm">
      <Button variant="secondary" className="h-8" disabled={page <= 1} onClick={() => onPage(page - 1)}>Назад</Button>
      <span className="text-[#667085]">{page} / {pages}</span>
      <Button variant="secondary" className="h-8" disabled={page >= pages} onClick={() => onPage(page + 1)}>Дальше</Button>
    </div>
  );
}

export function EmptyBox({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-[#667085]">{children}</p>;
}
