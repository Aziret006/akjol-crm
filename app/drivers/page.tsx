"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DriversScreen } from "@/components/drivers-screen";
import { EmployeesScreen } from "@/components/screens/employees-screen";
import { useCrm } from "@/lib/store";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-[#667085]">Загрузка…</p>}>
      <DriversRoute />
    </Suspense>
  );
}

function DriversRoute() {
  const crm = useCrm();
  const driverId = useSearchParams().get("id");
  if (crm.isAdmin && !driverId) return <EmployeesScreen />;
  return <DriversScreen />;
}
