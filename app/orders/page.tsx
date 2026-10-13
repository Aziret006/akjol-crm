"use client";

import { Suspense } from "react";
import { OrdersScreen } from "@/components/orders-screen";

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#667085]">Загрузка заказов…</p>}>
      <OrdersScreen />
    </Suspense>
  );
}
