import { applyPresence } from "@/lib/telephony/routing";
import { updateTelephony } from "@/lib/telephony/server-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: { userId?: unknown; role?: unknown; status?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (typeof payload.userId !== "string" || (payload.role !== "admin" && payload.role !== "dispatcher")) {
    return Response.json({ ok: false, error: "Нужны сотрудник и роль" }, { status: 400 });
  }
  if (payload.status !== "off_shift" && payload.status !== "available" && payload.status !== "break" && payload.status !== "finished") {
    return Response.json({ ok: false, error: "Статус «разговаривает» ставит только событие звонка" }, { status: 400 });
  }
  try {
    const result = await updateTelephony((state) => {
      const applied = applyPresence(
        state,
        { userId: payload.userId as string, role: payload.role as "admin" | "dispatcher", status: payload.status as "off_shift" | "available" | "break" | "finished" },
        new Date().toISOString(),
      );
      return { state: applied.state, result: applied };
    });
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 409 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Сервер не сохранил статус диспетчера" }, { status: 500 });
  }
}
