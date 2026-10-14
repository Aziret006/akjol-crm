"use client";

import { Suspense } from "react";
import { UsersScreen } from "@/components/platform/users-screen";

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-[#667085]">Загрузка пользователей…</p>}><UsersScreen /></Suspense>;
}
