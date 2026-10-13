import { setMaxConcurrent } from "@/lib/telephony/routing";
import { updateTelephony } from "@/lib/telephony/server-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (request.headers.get("x-akjol-role") !== "admin") {
    return Response.json({ ok: false, error: "Лимит меняет только администратор" }, { status: 403 });
  }
  let payload: { maxConcurrent?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Некорректное тело запроса" }, { status: 400 });
  }
  if (typeof payload.maxConcurrent !== "number" || !Number.isFinite(payload.maxConcurrent)) {
    return Response.json({ ok: false, error: "Укажите число одновременных звонков" }, { status: 400 });
  }
  try {
    await updateTelephony((state) => ({ state: setMaxConcurrent(state, payload.maxConcurrent as number), result: true }));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Не удалось сохранить лимит" }, { status: 500 });
  }
}
