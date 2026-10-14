"use client";

import { Suspense } from "react";
import { SupportScreen } from "@/components/platform/support-screen";

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-[#667085]">Загрузка поддержки…</p>}><SupportScreen /></Suspense>;
}
