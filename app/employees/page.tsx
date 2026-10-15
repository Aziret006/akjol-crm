"use client";

import { Suspense } from "react";
import { DriversScreen } from "@/components/drivers-screen";

export default function EmployeesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#667085]">Загрузка водителей…</p>}>
      <DriversScreen />
    </Suspense>
  );
}
