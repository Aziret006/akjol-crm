import { applyEvent, pushError } from "@/lib/telephony/routing";
import { connectionFromEnv, updateTelephony } from "@/lib/telephony/server-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const connection = connectionFromEnv();
  const now = new Date().toISOString();
  if (!connection.connected) {
    await updateTelephony((state) => ({
      state: pushError(state, "Событие отклонено: провайдер телефонии не настроен", now),
      result: null,
    }));
    return Response.json({ ok: false, error: "Телефония не подключена. Провайдер не выбран." }, { status: 503 });
  }
  const secret = request.headers.get("x-telephony-secret") ?? "";
  if (secret !== connection.secret) {
    await updateTelephony((state) => ({
      state: pushError(state, "Событие отклонено: неверная подпись webhook", now),
      result: null,
    }));
    return Response.json({ ok: false, error: "Неверная подпись webhook" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Некорректное тело запроса" }, { status: 400 });
  }
  const event = payload as { eventId?: unknown; type?: unknown; from?: unknown; at?: unknown; durationSec?: unknown; callId?: unknown };
  if (typeof event.eventId !== "string" || typeof event.type !== "string") {
    return Response.json({ ok: false, error: "Нужны eventId и type" }, { status: 400 });
  }
  if (event.type !== "incoming" && event.type !== "answered" && event.type !== "ended" && event.type !== "missed") {
    return Response.json({ ok: false, error: "Неизвестный тип события" }, { status: 400 });
  }
  try {
    const result = await updateTelephony((state) => {
      const applied = applyEvent(
        state,
        {
          eventId: event.eventId as string,
          type: event.type as "incoming" | "answered" | "ended" | "missed",
          from: typeof event.from === "string" ? event.from : undefined,
          at: typeof event.at === "string" ? event.at : undefined,
          durationSec: typeof event.durationSec === "number" ? event.durationSec : undefined,
          callId: typeof event.callId === "string" ? event.callId : undefined,
        },
        now,
      );
      return { state: applied.state, result: applied };
    });
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
    return Response.json({ ok: true, duplicate: result.duplicate, call: result.call });
  } catch {
    return Response.json({ ok: false, error: "Очередь временно недоступна, повторите событие" }, { status: 500 });
  }
}
