"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useCrm } from "@/lib/store";
import { emptyPlatform } from "./seed";
import type { PlatformAction, PlatformRole, PlatformState } from "./types";

function headers(userId: string) {
  return {
    "content-type": "application/json",
    "x-akjol-user": userId,
    "x-akjol-role": "admin",
  };
}

type Api = {
  ready: boolean;
  error: string;
  state: PlatformState;
  role: PlatformRole;
  run: (action: PlatformAction) => Promise<{ ok: true; error: string } | { ok: false; error: string }>;
};

const Context = createContext<Api | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const crm = useCrm();
  const [state, setState] = useState<PlatformState>(emptyPlatform);
  const [role, setRole] = useState<PlatformRole>("owner");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const user = crm.user;
  const userId = user?.id ?? "";
  const userName = user ? `${user.firstName} ${user.lastName}` : "";
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin || !userId) return;
    let cancelled = false;
    void fetch("/api/platform", { headers: headers(userId) })
      .then(async (response) => {
        const body = (await response.json()) as { state?: PlatformState; platformRole?: PlatformRole; error?: string };
        if (cancelled) return;
        if (!response.ok || !body.state) {
          setError(body.error ?? "Не удалось загрузить панель");
          setReady(true);
          return;
        }
        setState(body.state);
        setRole(body.platformRole ?? "owner");
        setError("");
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Сервер панели не ответил");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, userId, userName]);

  const run = useCallback(async (action: PlatformAction) => {
    if (!isAdmin || !userId) return { ok: false as const, error: "Нет прав" };
    const response = await fetch("/api/platform", {
      method: "POST",
      headers: headers(userId),
      body: JSON.stringify({ action, actorName: userName }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string; state?: PlatformState; platformRole?: PlatformRole };
    if (body.state) setState(body.state);
    if (body.platformRole) setRole(body.platformRole);
    if (!response.ok || !body.ok) return { ok: false as const, error: body.error ?? "Действие не выполнено" };
    return { ok: true as const, error: "" };
  }, [isAdmin, userId, userName]);

  return <Context.Provider value={{ ready, error, state, role, run }}>{children}</Context.Provider>;
}

export function usePlatform() {
  const value = useContext(Context);
  if (!value) throw new Error("PlatformProvider missing");
  return value;
}
