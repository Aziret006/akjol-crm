import { linkOrder } from "@/lib/telephony/routing";
import { updateTelephony } from "@/lib/telephony/server-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = request.headers.get("x-akjol-user")?.trim() || "";
  const role = request.headers.get("x-akjol-role") === "admin" ? "admin" : "dispatcher";
  let payload: { callId?: unknown; orderId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (typeof payload.callId !== "string" || typeof payload.orderId !== "string" || !payload.orderId.trim()) {
    return Response.json({ ok: false, error: "Нужны звонок и заказ" }, { status: 400 });
  }
  try {
    const result = await updateTelephony<{ ok: true } | { ok: false; error: string }>((state) => {
      const call = state.calls.find((item) => item.id === payload.callId);
      if (!call) return { state, result: { ok: false as const, error: "Звонок не найден" } };
      if (role !== "admin" && call.dispatcherId !== userId) {
        return { state, result: { ok: false as const, error: "Этот звонок назначен другому диспетчеру" } };
      }
      const applied = linkOrder(state, payload.callId as string, (payload.orderId as string).trim());
      if (!applied.ok) return { state: applied.state, result: { ok: false as const, error: applied.error } };
      return { state: applied.state, result: { ok: true as const } };
    });
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 403 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Не удалось сохранить связь с заказом" }, { status: 500 });
  }
}
