"use client";

import { useSyncExternalStore } from "react";
import type { PresenceStatus, TelephonyPublic } from "./model";

const EMPTY: TelephonyPublic = {
  connected: false,
  provider: null,
  sharedNumber: null,
  browserAnswer: false,
  answerHint: "Телефония не подключена. Входящий звонок в CRM не поступает, кнопка ответа в браузере не работает.",
  maxConcurrent: 1,
  queueCount: 0,
  queueNote: "Очередь АТС не запрашивается: провайдер не выбран.",
  active: [],
  dispatchers: [],
  missed: 0,
  errors: [],
  calls: [],
};

let current = EMPTY;
let error = "";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function headers(userId: string, role: "admin" | "dispatcher") {
  return { "content-type": "application/json", "x-akjol-user": userId, "x-akjol-role": role };
}

export function useTelephony() {
  const status = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => EMPTY,
  );
  const syncError = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => error,
    () => "",
  );
  return { status, syncError };
}

export function pollTelephony(userId: string, role: "admin" | "dispatcher") {
  let stopped = false;
  async function load() {
    try {
      const response = await fetch("/api/telephony/status", { headers: headers(userId, role) });
      if (!response.ok) throw new Error("Сервер телефонии не ответил");
      current = (await response.json()) as TelephonyPublic;
      error = "";
    } catch {
      error = "Не удалось получить статус телефонии с сервера.";
    }
    if (!stopped) emit();
  }
  void load();
  const timer = window.setInterval(() => void load(), 15000);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

export async function postPresence(input: { userId: string; role: "admin" | "dispatcher"; status: PresenceStatus }) {
  const response = await fetch("/api/telephony/presence", {
    method: "POST",
    headers: headers(input.userId, input.role),
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || body.ok === false) {
    error = body.error || "Сервер не подтвердил статус для распределения звонков.";
    emit();
    return;
  }
  error = "";
  emit();
}

export async function linkCallToOrder(userId: string, role: "admin" | "dispatcher", callId: string, orderId: string) {
  const response = await fetch("/api/telephony/calls", {
    method: "POST",
    headers: headers(userId, role),
    body: JSON.stringify({ callId, orderId }),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || body.ok === false) return body.error || "Не удалось связать звонок с заказом";
  return "";
}

export async function saveCallCapacity(userId: string, value: number) {
  const response = await fetch("/api/telephony/settings", {
    method: "POST",
    headers: headers(userId, "admin"),
    body: JSON.stringify({ maxConcurrent: value }),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || body.ok === false) return body.error || "Не удалось сохранить лимит";
  return "";
}
