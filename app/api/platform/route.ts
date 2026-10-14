import { operatorRole, readPlatform, runPlatform } from "@/lib/platform/store";
import type { PlatformAction } from "@/lib/platform/types";

export const runtime = "nodejs";

function actorFrom(request: Request) {
  const userId = request.headers.get("x-akjol-user")?.trim() || "";
  const role = request.headers.get("x-akjol-role")?.trim();
  const name = request.headers.get("x-akjol-name")?.trim() || "Администратор";
  if (!userId || role !== "admin") return null;
  return { userId, name };
}

export async function GET(request: Request) {
  try {
    const actor = actorFrom(request);
    if (!actor) return Response.json({ error: "Нужна учётная запись администратора таксопарка" }, { status: 403 });
    const state = await readPlatform();
    const platformRole = operatorRole(state, actor.userId) ?? "owner";
    return Response.json({ state, platformRole, source: "demo" });
  } catch {
    return Response.json({ error: "Не удалось прочитать панель платформы" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = actorFrom(request);
    if (!actor) return Response.json({ error: "Нужна учётная запись администратора таксопарка" }, { status: 403 });
    const body = (await request.json()) as { action?: PlatformAction; actorName?: string };
    if (!body.action?.type) return Response.json({ error: "Не указано действие" }, { status: 400 });
    const state = await readPlatform();
    const platformRole = operatorRole(state, actor.userId) ?? "owner";
    const result = await runPlatform({ id: actor.userId, name: body.actorName?.trim() || actor.name, role: platformRole }, body.action);
    return Response.json({ ok: result.ok, error: result.error ?? "", state: result.state, platformRole });
  } catch {
    return Response.json({ error: "Не удалось сохранить изменение" }, { status: 500 });
  }
}
