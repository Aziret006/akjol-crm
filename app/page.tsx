"use client";

import { DispatchDesk } from "@/components/dispatch-desk";
import { LoginForm } from "@/components/login-form";
import { ManagerDashboard } from "@/components/manager-dashboard";
import { useCrm } from "@/lib/store";

export default function HomePage() {
  const crm = useCrm();
  if (!crm.ready) return <p className="text-[#667085]">Загрузка данных…</p>;
  if (!crm.user) return <LoginForm />;
  return crm.isAdmin ? <ManagerDashboard /> : <DispatchDesk />;
}
