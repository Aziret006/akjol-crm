"use client";

import { useEffect } from "react";
import { currentStatus } from "@/lib/attendance";
import { pollTelephony, postPresence } from "@/lib/telephony/client";
import { presenceFromWork } from "@/lib/telephony/presence";
import { useCrm } from "@/lib/store";

export function TelephonyBridge() {
  const crm = useCrm();
  const userId = crm.user?.id ?? "";
  const role = crm.user?.role ?? "dispatcher";
  const work = crm.user ? currentStatus(crm.state.events, crm.user.id) : "idle";

  useEffect(() => {
    if (!crm.ready || !crm.user || crm.readOnly) return;
    void postPresence({ userId: crm.user.id, role: crm.user.role, status: presenceFromWork(work) });
  }, [crm.ready, crm.readOnly, crm.user, work]);

  useEffect(() => {
    if (!crm.ready || !userId) return;
    return pollTelephony(userId, crm.isAdmin ? "admin" : role);
  }, [crm.ready, crm.isAdmin, role, userId]);

  return null;
}
