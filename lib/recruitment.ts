import type { DocKind, DocStatus, Driver, DriverTask, LeadSource, Order, RecruitStage, StopReason, User } from "./types";
import { addDays, bishkekDateString, datesBetween, inDateRange } from "./time";

export const PIPELINE: Exclude<RecruitStage, "stopped">[] = ["application", "call", "documents", "srmk", "activation", "first_order"];

export const DOC_KINDS: DocKind[] = ["passport", "license", "sts", "insurance", "inspection"];

export const STAGE_LABEL: Record<RecruitStage, string> = {
  application: "Заявка",
  call: "Звонок",
  documents: "Документы",
  srmk: "Проверка СРМК",
  activation: "Активация",
  first_order: "1-й заказ",
  stopped: "Остановлен",
};

export const STAGE_LABEL_KY: Record<RecruitStage, string> = {
  application: "Өтүнмө",
  call: "Чалуу",
  documents: "Документтер",
  srmk: "СРМК текшерүү",
  activation: "Активация",
  first_order: "1-заказ",
  stopped: "Токтоду",
};

export const STOP_LABEL: Record<StopReason, string> = {
  no_license: "Нет ВУ при себе",
  competitor: "Ушёл к конкуренту",
  car_problem: "Проблемы с авто",
  app_unclear: "Не разобрался с приложением",
  no_answer: "Не выходит на связь",
  other: "Другая причина",
};

export const SOURCE_LEAD_LABEL: Record<LeadSource, string> = {
  target: "Таргет / реклама",
  referral: "Рекомендация",
  offline: "Офлайн-точка",
  partner: "Партнёр",
  phone: "Звонок",
  whatsapp: "WhatsApp",
  other: "Другое",
};

export const DOC_LABEL: Record<DocKind, string> = {
  passport: "Паспорт",
  license: "Водительское удостоверение",
  sts: "СТС",
  insurance: "Страховка",
  inspection: "Техосмотр",
};

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  missing: "Нет",
  received: "Получен",
  verified: "Проверен",
  rejected: "Отклонён",
};

export function emptyDocs(): Record<DocKind, DocStatus> {
  return { passport: "missing", license: "missing", sts: "missing", insurance: "missing", inspection: "missing" };
}

function isStage(value: unknown): value is RecruitStage {
  return value === "application" || value === "call" || value === "documents" || value === "srmk" || value === "activation" || value === "first_order" || value === "stopped";
}

function isStop(value: unknown): value is StopReason {
  return value === "no_license" || value === "competitor" || value === "car_problem" || value === "app_unclear" || value === "no_answer" || value === "other";
}

function isSource(value: unknown): value is LeadSource {
  return value === "target" || value === "referral" || value === "offline" || value === "partner" || value === "phone" || value === "whatsapp" || value === "other";
}

function isDocStatus(value: unknown): value is DocStatus {
  return value === "missing" || value === "received" || value === "verified" || value === "rejected";
}

const DEMO_STAGE: Record<string, RecruitStage> = {
  "drv-kubat": "activation",
  "drv-nursultan": "documents",
  "drv-timur": "call",
  "drv-azamat": "stopped",
};

const DEMO_OWNER: Record<string, string> = {
  "drv-kubat": "u-aigul",
  "drv-nursultan": "u-aigul",
  "drv-azamat": "u-nurlan",
};

const DEMO_SOURCE: Record<string, LeadSource> = {
  "drv-kubat": "referral",
  "drv-nursultan": "offline",
  "drv-timur": "target",
  "drv-azamat": "partner",
};

export function normalizeDriver(input: Driver): Driver {
  const demo = input.demo === true || (typeof input.note === "string" && input.note.includes("Демо"));
  const stage = isStage(input.stage) ? input.stage : (demo && DEMO_STAGE[input.id]) || "application";
  const docs = emptyDocs();
  for (const kind of DOC_KINDS) {
    const value = input.docs?.[kind];
    if (isDocStatus(value)) docs[kind] = value;
  }
  const createdAt = input.createdAt || new Date().toISOString();
  const log = Array.isArray(input.stageLog)
    ? input.stageLog.filter((item) => item && isStage(item.stage) && typeof item.at === "string")
    : [];
  return {
    id: input.id,
    firstName: input.firstName || "",
    lastName: input.lastName || "",
    phone: input.phone || "",
    availability: input.availability === "offline" ? "offline" : "available",
    vehicle: input.vehicle ?? null,
    note: typeof input.note === "string" ? input.note : "",
    createdAt,
    city: input.city || "Бишкек",
    address: input.address || "",
    citizenship: input.citizenship || "",
    inn: input.inn || "",
    licenseNumber: input.licenseNumber || "",
    plate: input.plate || "",
    carModel: input.carModel || input.vehicle || "",
    carColor: input.carColor || "",
    carYear: typeof input.carYear === "number" && input.carYear > 1980 ? input.carYear : null,
    carCategory: input.carCategory || "",
    docs,
    stage,
    stopNote: input.stopNote || "",
    source: isSource(input.source) && !(demo && input.source === "other" && DEMO_SOURCE[input.id]) ? input.source : (demo && DEMO_SOURCE[input.id]) || "other",
    ownerId: input.ownerId || (demo ? DEMO_OWNER[input.id] ?? null : null),
    stageLog: log.length ? log : [{ stage, at: createdAt, actorId: null }],
    pitchNoted: Boolean(input.pitchNoted),
    demo,
    stopReason: isStop(input.stopReason) ? input.stopReason : input.id === "drv-azamat" && stage === "stopped" ? "car_problem" : null,
  };
}

export function stageIndex(stage: RecruitStage) {
  if (stage === "stopped") return -1;
  return PIPELINE.indexOf(stage);
}

export function reachedStage(driver: Driver, stage: Exclude<RecruitStage, "stopped">, orders: Order[]) {
  if (stage === "first_order" && orders.some((order) => order.driverId === driver.id && order.status === "done")) return true;
  if (driver.stage === "stopped") {
    const last = [...driver.stageLog].reverse().find((item) => item.stage !== "stopped");
    const at = last ? stageIndex(last.stage) : 0;
    return at >= stageIndex(stage);
  }
  return stageIndex(driver.stage) >= stageIndex(stage);
}

export function hasFirstOrder(driver: Driver, orders: Order[]) {
  return driver.stage === "first_order" || orders.some((order) => order.driverId === driver.id && order.status === "done");
}

export function canSeeDriver(driver: Driver, userId: string, viewAll: boolean) {
  if (viewAll) return true;
  if (driver.ownerId === userId) return true;
  return !driver.ownerId && (driver.stage === "application" || driver.stage === "call");
}

export function canEditDriver(driver: Driver, userId: string, viewAll: boolean) {
  if (viewAll) return true;
  return driver.ownerId === userId || (!driver.ownerId && (driver.stage === "application" || driver.stage === "call"));
}

export type Window = { from: string; to: string; prevFrom: string; prevTo: string };

export function recruitmentWindow(days: 1 | 7 | 30, today: string): Window {
  const span = days - 1;
  return {
    from: addDays(today, -span),
    to: today,
    prevFrom: addDays(today, -span - days),
    prevTo: addDays(today, -days),
  };
}

export function driversInWindow(drivers: Driver[], from: string, to: string) {
  return drivers.filter((driver) => inDateRange(driver.createdAt, from, to));
}

export function countReached(drivers: Driver[], orders: Order[], stage: Exclude<RecruitStage, "stopped">) {
  return drivers.filter((driver) => reachedStage(driver, stage, orders)).length;
}

export function lossPercent(previous: number, next: number) {
  if (previous <= 0) return null;
  return Math.round(((previous - next) / previous) * 100);
}

export function delta(current: number, previous: number) {
  if (current === previous) return { tone: "flat" as const, text: "без изменений" };
  if (previous === 0) return { tone: current > 0 ? "up" as const : "down" as const, text: "в прошлом периоде было 0" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { tone: pct > 0 ? "up" as const : "down" as const, text: `${pct > 0 ? "+" : ""}${pct}% к прошлому периоду` };
}

export function firstOrderAt(driver: Driver, orders: Order[]) {
  const done = orders
    .filter((order) => order.driverId === driver.id && order.status === "done")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  if (done[0]) return done[0].updatedAt;
  if (driver.stage === "first_order") return [...driver.stageLog].reverse().find((item) => item.stage === "first_order")?.at ?? null;
  return null;
}

export function hoursToFirst(driver: Driver, orders: Order[]) {
  const at = firstOrderAt(driver, orders);
  if (!at) return null;
  const ms = new Date(at).getTime() - new Date(driver.createdAt).getTime();
  if (ms < 0) return null;
  return ms / 3600000;
}

export function dailySeries(drivers: Driver[], orders: Order[], from: string, to: string) {
  return datesBetween(from, to).map((day) => ({
    day,
    registered: drivers.filter((driver) => bishkekDateString(new Date(driver.createdAt)) === day).length,
    first: drivers.filter((driver) => {
      const at = firstOrderAt(driver, orders);
      return at ? bishkekDateString(new Date(at)) === day : false;
    }).length,
  }));
}

export function sourceCounts(drivers: Driver[]) {
  return (Object.keys(SOURCE_LEAD_LABEL) as LeadSource[]).map((source) => ({
    source,
    count: drivers.filter((driver) => driver.source === source).length,
  })).filter((item) => item.count > 0);
}

export function stopCounts(drivers: Driver[]) {
  return (Object.keys(STOP_LABEL) as StopReason[]).map((reason) => ({
    reason,
    count: drivers.filter((driver) => driver.stage === "stopped" && driver.stopReason === reason).length,
  })).filter((item) => item.count > 0);
}

export function openTasks(tasks: DriverTask[]) {
  return tasks.filter((task) => !task.doneAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || (a.priority === "high" ? -1 : 1));
}

export function isOverdue(task: DriverTask, now: number) {
  return !task.doneAt && new Date(task.dueAt).getTime() < now;
}

export function visibleDrivers(drivers: Driver[], user: User, viewAll: boolean) {
  return drivers.filter((driver) => canSeeDriver(driver, user.id, viewAll));
}
