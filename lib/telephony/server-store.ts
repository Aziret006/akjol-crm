import { promises as fs } from "fs";
import path from "path";
import { emptyTelephony } from "./routing";
import type { TelephonyFile } from "./model";

const filePath = path.join(process.cwd(), ".data", "telephony.json");

let chain: Promise<void> = Promise.resolve();

async function readFile(): Promise<TelephonyFile> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as TelephonyFile;
    if (!parsed || !Array.isArray(parsed.calls) || !Array.isArray(parsed.presences)) return emptyTelephony();
    return {
      presences: parsed.presences,
      calls: parsed.calls,
      seen: Array.isArray(parsed.seen) ? parsed.seen : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      maxConcurrent: typeof parsed.maxConcurrent === "number" ? parsed.maxConcurrent : 1,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyTelephony();
    throw error;
  }
}

async function writeFile(state: TelephonyFile) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state), "utf8");
  await fs.rename(temp, filePath);
}

export function updateTelephony<T>(change: (state: TelephonyFile) => { state: TelephonyFile; result: T } | Promise<{ state: TelephonyFile; result: T }>) {
  const run = chain.then(async () => {
    const current = await readFile();
    const next = await change(current);
    await writeFile(next.state);
    return next.result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readTelephony() {
  return readFile();
}

export function connectionFromEnv() {
  const provider = process.env.TELEPHONY_PROVIDER?.trim() || "";
  const secret = process.env.TELEPHONY_WEBHOOK_SECRET?.trim() || "";
  const sharedNumber = process.env.TELEPHONY_SHARED_NUMBER?.trim() || "";
  return {
    connected: Boolean(provider && secret),
    provider: provider || null,
    sharedNumber: sharedNumber || null,
    secret,
  };
}
