"use client";

import { useState } from "react";
import { OrderForm } from "@/components/order-form";
import { Button, ErrorText } from "@/components/ui";
import { DESK_STATUS_LABEL } from "@/lib/labels";
import { phoneDigits } from "@/lib/orders";
import { linkCallToOrder, useTelephony } from "@/lib/telephony/client";
import { useCrm } from "@/lib/store";
import { formatDateTime } from "@/lib/time";

export function CallPanel() {
  const crm = useCrm();
  const { status, syncError } = useTelephony();
  const [openCard, setOpenCard] = useState(false);
  const [form, setForm] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const user = crm.user;
  if (!user) return null;

  const mine = status.dispatchers.find((item) => item.userId === user.id);
  const call = status.active.find((item) => item.dispatcherId === user.id) ?? null;
  const customer = call
    ? crm.state.customers.find((item) => phoneDigits(item.phone) === phoneDigits(call.from)) ?? null
    : null;
  const history = customer
    ? crm.state.orders.filter((order) => order.customerId === customer.id)
    : [];
  const userId = user.id;
  const role = user.role;

  async function link(nextOrderId: string) {
    if (!call) return;
    const message = await linkCallToOrder(userId, role, call.id, nextOrderId);
    setError(message);
  }

  return (
    <section className="crm-panel p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Для звонков: {mine ? DESK_STATUS_LABEL[mine.status] : "сервер ещё не подтвердил статус"}
          {mine && mine.load > 0 ? ` · линия ${mine.load}` : ""}
        </p>
        <p className="text-[#667085]">{status.answerHint}</p>
      </div>
      {syncError ? <p className="mt-2 text-[#b42318]">{syncError}</p> : null}
      {!call ? <p className="mt-2 text-[#667085]">Входящего звонка нет.</p> : (
        <div className="mt-3 space-y-2 border-t border-[#e6e8ec] pt-3">
          <p className="font-medium">{call.from}</p>
          <p>{customer ? customer.name : "Номер в базе не найден"}</p>
          <p className="text-[#667085]">Поступил {formatDateTime(call.arrivedAt)}{call.answeredAt ? ` · ответ ${formatDateTime(call.answeredAt)}` : " · ответа от телефонии ещё нет"}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpenCard((value) => !value)}>{openCard ? "Скрыть карточку" : "Карточка клиента"}</Button>
            <Button type="button" disabled={crm.readOnly} onClick={() => setForm(true)}>Создать заказ</Button>
          </div>
          {openCard ? (
            <div className="rounded-lg bg-[#f7f8fa] p-3">
              {history.length === 0 ? <p className="text-[#667085]">Заказов этого клиента нет</p> : (
                <ul className="space-y-1">
                  {history.slice(0, 6).map((order) => <li key={order.id}>№{order.number} · {order.pickup}</li>)}
                </ul>
              )}
              <form className="mt-2 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void link(orderId); }}>
                <select className="h-9 rounded-lg border border-[#e6e8ec] bg-white px-2" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                  <option value="">Связать с заказом</option>
                  {crm.state.orders.filter((order) => order.status !== "cancelled").slice(0, 20).map((order) => (
                    <option key={order.id} value={order.id}>№{order.number} · {order.pickup}</option>
                  ))}
                </select>
                <Button variant="secondary" type="submit" disabled={!orderId || crm.readOnly}>Связать</Button>
              </form>
            </div>
          ) : null}
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {form && call ? (
        <OrderForm
          preset={{ phone: call.from, name: customer?.name, source: "phone", callId: call.id }}
          onClose={() => setForm(false)}
          onCreated={(createdId) => { void link(createdId); }}
        />
      ) : null}
    </section>
  );
}
