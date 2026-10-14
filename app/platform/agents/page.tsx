"use client";

import { Suspense } from "react";
import { AgentsScreen } from "@/components/platform/agents-screen";

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-[#667085]">Загрузка агентов…</p>}><AgentsScreen /></Suspense>;
}
