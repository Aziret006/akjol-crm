"use client";

import { useState } from "react";
import { Button, Field, controlClass } from "@/components/ui";
import { platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { PERIOD_LABEL, SUB_STATUS_LABEL, money } from "@/lib/platform/labels";
import type { Plan, PlanPeriod, SubscriptionStatus } from "@/lib/platform/types";
import { formatDate } from "@/lib/time";
import { EmptyBox, Pill } from "./widgets";

const emptyPlan = (): Plan => ({
  id: "",
  name: "",
  description: "",
  price: 0,
  currency: "KGS",
  period: "month",
  staffLimit: 5,
  channelLimit: 2,
  features: ["Заказы"],
  aiDialogLimit: 100,
  available: true,
});

export function PlansScreen() {
  const { state, role, run } = usePlatform();
  const [draft, setDraft] = useState<Plan | null>(null);
  const [filter, setFilter] = useState<"all" | SubscriptionStatus>("all");
  const [message, setMessage] = useState("");
  if (!platformAllows(role, "plans.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;
  const canEdit = platformAllows(role, "plans.edit");
  const subs = state.subscriptions.filter((item) => filter === "all" || item.status === filter);

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-[#1f7a45]">{message}</p> : null}
      <div className="flex justify-end">{canEdit ? <Button onClick={() => setDraft(emptyPlan())}>Новый тариф</Button> : null}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        {state.plans.map((plan) => (
          <article key={plan.id} className="crm-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-sm text-[#667085]">{plan.description}</p>
              </div>
              <Pill text={plan.available ? "Доступен" : "Скрыт"} tone={plan.available ? "green" : "gray"} />
            </div>
            <p className="mt-2 text-lg font-semibold">{money(plan.price)} · {PERIOD_LABEL[plan.period]}</p>
            <p className="mt-1 text-sm text-[#667085]">Сотрудники: {plan.staffLimit} · каналы: {plan.channelLimit} · AI-диалоги: {plan.aiDialogLimit}</p>
            <p className="mt-1 text-sm">{plan.features.join(", ")}</p>
            {canEdit ? <Button className="mt-3" variant="secondary" onClick={() => setDraft(plan)}>Изменить</Button> : null}
          </article>
        ))}
      </div>
      <section className="crm-panel">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <h3 className="font-semibold">Подписки</h3>
          <select className={`${controlClass} ml-auto w-auto`} value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="trial">Пробные</option>
            <option value="expiring">Скоро истекают</option>
            <option value="overdue">Просроченные</option>
            <option value="cancelled">Отменённые</option>
          </select>
        </div>
        {subs.length === 0 ? <EmptyBox>Подписок нет</EmptyBox> : subs.map((item) => {
          const company = state.companies.find((row) => row.id === item.companyId);
          const plan = state.plans.find((row) => row.id === item.planId);
          return (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6e8ec] px-4 py-2 text-sm">
              <span>{company?.name} · {plan?.name}</span>
              <span className="text-[#667085]">{formatDate(item.startedAt)} — {formatDate(item.endsAt)} · {money(item.amount)} · {item.paid ? "оплачена" : "не оплачена"}</span>
              <Pill text={SUB_STATUS_LABEL[item.status]} />
            </div>
          );
        })}
      </section>
      {draft ? (
        <PlanForm
          plan={draft}
          onClose={() => setDraft(null)}
          onSave={async (plan) => {
            const result = await run({ type: "save-plan", plan: { ...plan, id: plan.id || `p-${plan.name.toLowerCase().replace(/\s+/g, "-")}` } });
            setMessage(result.ok ? "Тариф сохранён" : result.error);
            if (result.ok) setDraft(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PlanForm({ plan, onClose, onSave }: { plan: Plan; onClose: () => void; onSave: (plan: Plan) => void }) {
  const [draft, setDraft] = useState(plan);
  return (
    <div className="crm-panel space-y-3 p-4">
      <h3 className="font-semibold">{plan.id ? "Изменить тариф" : "Новый тариф"}</h3>
      <Field label="Название"><input className={controlClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
      <Field label="Описание"><input className={controlClass} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Цена, сом"><input className={controlClass} type="number" min={0} value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></Field>
        <Field label="Период">
          <select className={controlClass} value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value as PlanPeriod })}>
            {(Object.keys(PERIOD_LABEL) as PlanPeriod[]).map((item) => <option key={item} value={item}>{PERIOD_LABEL[item]}</option>)}
          </select>
        </Field>
        <Field label="Лимит сотрудников"><input className={controlClass} type="number" min={1} value={draft.staffLimit} onChange={(event) => setDraft({ ...draft, staffLimit: Number(event.target.value) })} /></Field>
        <Field label="Лимит каналов"><input className={controlClass} type="number" min={0} value={draft.channelLimit} onChange={(event) => setDraft({ ...draft, channelLimit: Number(event.target.value) })} /></Field>
        <Field label="Лимит AI-диалогов"><input className={controlClass} type="number" min={0} value={draft.aiDialogLimit} onChange={(event) => setDraft({ ...draft, aiDialogLimit: Number(event.target.value) })} /></Field>
      </div>
      <Field label="Функции через запятую"><input className={controlClass} value={draft.features.join(", ")} onChange={(event) => setDraft({ ...draft, features: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} /> Тариф доступен к продаже</label>
      <div className="flex gap-2">
        <Button onClick={() => onSave(draft)}>Сохранить</Button>
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
      </div>
    </div>
  );
}
