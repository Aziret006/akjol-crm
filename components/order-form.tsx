"use client";

import { useState } from "react";
import { ORDER_SOURCE_LABEL, ORDER_SOURCE_OPTIONS, PAYMENT_LABEL, fullName } from "@/lib/labels";
import { driverDuty, findCustomerByPhone } from "@/lib/orders";
import type { OrderInput } from "@/lib/store";
import { useCrm } from "@/lib/store";
import type { OrderSource, PaymentMethod } from "@/lib/types";
import { Button, ErrorText, Field, Modal, controlClass } from "./ui";

export function OrderForm({
  onClose,
  onCreated,
  preset,
}: {
  onClose: () => void;
  onCreated?: (orderId: string) => void;
  preset?: {
    phone?: string;
    name?: string;
    source?: OrderSource;
    conversationId?: string | null;
    callId?: string | null;
  };
}) {
  const crm = useCrm();
  const [key] = useState(() => crypto.randomUUID());
  const [phone, setPhone] = useState(preset?.phone ?? "");
  const [name, setName] = useState(preset?.name ?? "");
  const [pickup, setPickup] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [pickupAt, setPickupAt] = useState("");
  const [source, setSource] = useState<OrderSource>(preset?.source ?? "phone");
  const [dropoff, setDropoff] = useState("");
  const [comment, setComment] = useState("");
  const [vehicleNote, setVehicleNote] = useState("");
  const [passengers, setPassengers] = useState("");
  const [payment, setPayment] = useState<"" | PaymentMethod>("");
  const [price, setPrice] = useState("");
  const [driverId, setDriverId] = useState("");
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [pending, setPending] = useState(false);

  const matched = findCustomerByPhone(crm.state.customers, phone);

  function submit(confirmDuplicate: boolean) {
    if (pending) return;
    setPending(true);
    setError("");
    const parsedPassengers = passengers.trim() ? Number(passengers) : null;
    const parsedPrice = price.trim() ? Number(price.replace(",", ".")) : null;
    const input: OrderInput = {
      phone,
      name: matched ? matched.name : name,
      pickup,
      dropoff,
      pickupAt: when === "later" ? (pickupAt ? new Date(pickupAt).toISOString() : null) : null,
      comment,
      vehicleNote,
      passengers: parsedPassengers,
      payment: payment || null,
      price: parsedPrice,
      source,
      driverId: driverId || null,
      conversationId: preset?.conversationId ?? null,
      callId: preset?.callId ?? null,
      idempotencyKey: key,
      confirmDuplicate,
    };
    if (when === "later" && !pickupAt) {
      setPending(false);
      setError("Укажите время подачи");
      return;
    }
    const result = crm.createOrder(input);
    setPending(false);
    if (!result.ok && result.code === "duplicate-order") {
      setDuplicate(true);
      setError(result.error);
      return;
    }
    if (!result.ok) {
      setDuplicate(false);
      setError(result.error);
      return;
    }
    if (result.orderId) onCreated?.(result.orderId);
    onClose();
  }

  return (
    <Modal title="Принять заказ" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit(duplicate);
        }}
      >
        <Field label="Телефон клиента">
          <input className={controlClass} value={phone} onChange={(event) => { setPhone(event.target.value); setDuplicate(false); }} inputMode="tel" required autoFocus />
        </Field>
        {matched ? (
          <p className="text-sm text-[#1f7a45]">Клиент найден: {matched.name}</p>
        ) : phone.replace(/\D/g, "").length >= 6 ? (
          <p className="text-sm text-[#667085]">Новый номер. Карточка клиента создастся при сохранении.</p>
        ) : null}
        <Field label="Адрес подачи">
          <input className={controlClass} value={pickup} onChange={(event) => { setPickup(event.target.value); setDuplicate(false); }} required />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm text-[#667085]">Время подачи</legend>
          <div className="flex gap-2">
            <button type="button" className={when === "now" ? "h-9 rounded-lg bg-[#2e6db4] px-3 text-sm text-white" : "h-9 rounded-lg border border-[#e6e8ec] px-3 text-sm"} onClick={() => setWhen("now")}>Сейчас</button>
            <button type="button" className={when === "later" ? "h-9 rounded-lg bg-[#2e6db4] px-3 text-sm text-white" : "h-9 rounded-lg border border-[#e6e8ec] px-3 text-sm"} onClick={() => setWhen("later")}>Ко времени</button>
          </div>
          {when === "later" ? <input className={controlClass} type="datetime-local" value={pickupAt} onChange={(event) => setPickupAt(event.target.value)} required /> : null}
        </fieldset>
        <Field label="Источник">
          <select className={controlClass} value={source} onChange={(event) => setSource(event.target.value as OrderSource)}>
            {ORDER_SOURCE_OPTIONS.map((item) => <option key={item} value={item}>{ORDER_SOURCE_LABEL[item]}</option>)}
          </select>
        </Field>
        <details className="rounded-lg border border-[#e6e8ec] px-3 py-2">
          <summary className="cursor-pointer text-sm">Дополнительно</summary>
          <div className="mt-3 space-y-3">
            <Field label="Имя клиента">
              <input className={controlClass} value={matched ? matched.name : name} disabled={Boolean(matched)} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Адрес назначения">
              <input className={controlClass} value={dropoff} onChange={(event) => setDropoff(event.target.value)} />
            </Field>
            <Field label="Требования к авто">
              <input className={controlClass} value={vehicleNote} onChange={(event) => setVehicleNote(event.target.value)} />
            </Field>
            <Field label="Комментарий">
              <textarea className={`${controlClass} h-16 py-2`} value={comment} onChange={(event) => setComment(event.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Пассажиры">
                <input className={controlClass} inputMode="numeric" value={passengers} onChange={(event) => setPassengers(event.target.value)} />
              </Field>
              <Field label="Оплата">
                <select className={controlClass} value={payment} onChange={(event) => setPayment(event.target.value as "" | PaymentMethod)}>
                  <option value="">Не указана</option>
                  {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((item) => <option key={item} value={item}>{PAYMENT_LABEL[item]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Предварительная стоимость, сом">
              <input className={controlClass} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
            </Field>
            <Field label="Водитель">
              <select className={controlClass} value={driverId} onChange={(event) => setDriverId(event.target.value)}>
                <option value="">Назначить позже</option>
                {crm.state.drivers.map((driver) => {
                  const duty = driverDuty(crm.state.orders, driver);
                  return (
                    <option key={driver.id} value={driver.id} disabled={duty !== "available"}>
                      {fullName(driver)}{duty === "available" ? "" : duty === "busy" ? " — занят" : " — не на линии"}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
        </details>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={pending || crm.readOnly}>{duplicate ? "Всё равно создать" : "Сохранить заказ"}</Button>
        </div>
      </form>
    </Modal>
  );
}
