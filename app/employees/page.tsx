import { Suspense } from "react";
import { EmployeesScreen } from "@/components/screens/employees-screen";

export default function EmployeesPage() {
  return (
    <Suspense fallback={null}>
      <EmployeesScreen />
    </Suspense>
  );
}
