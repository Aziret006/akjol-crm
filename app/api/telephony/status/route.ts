import { toPublic } from "@/lib/telephony/routing";
import { connectionFromEnv, readTelephony } from "@/lib/telephony/server-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const state = await readTelephony();
    const connection = connectionFromEnv();
    const userId = request.headers.get("x-akjol-user")?.trim() || "";
    const role = request.headers.get("x-akjol-role") === "admin" ? "admin" : "dispatcher";
    return Response.json(toPublic(state, connection, { userId, role }));
  } catch {
    return Response.json({ error: "Не удалось прочитать очередь телефонии" }, { status: 500 });
  }
}
