import type { WorkStatus } from "../types";
import type { PresenceStatus } from "./model";

export function presenceFromWork(status: WorkStatus): PresenceStatus {
  if (status === "working") return "available";
  if (status === "away") return "break";
  if (status === "finished") return "finished";
  return "off_shift";
}
