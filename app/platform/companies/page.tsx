"use client";

import { Suspense } from "react";
import { CompaniesScreen } from "@/components/platform/companies-screen";

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-[#667085]">Загрузка компаний…</p>}><CompaniesScreen /></Suspense>;
}
