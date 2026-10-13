export type PresenceStatus = "off_shift" | "available" | "break" | "finished";

export type DeskStatus = PresenceStatus | "talking";

export type CallState = "queued" | "assigned" | "answered" | "ended";

export type CallResult = "answered" | "missed";

export type TelephonyCall = {
  id: string;
  eventId: string;
  from: string;
  arrivedAt: string;
  assignedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  dispatcherId: string | null;
  state: CallState;
  result: CallResult | null;
  orderId: string | null;
  queueReason: string | null;
};

export type TelephonyPresence = {
  userId: string;
  role: "admin" | "dispatcher";
  status: PresenceStatus;
  updatedAt: string;
  lastAssignedAt: string | null;
};

export type TelephonyError = {
  id: string;
  at: string;
  message: string;
  eventId: string | null;
};

export type TelephonyFile = {
  presences: TelephonyPresence[];
  calls: TelephonyCall[];
  seen: string[];
  errors: TelephonyError[];
  maxConcurrent: number;
};

export type TelephonyWebhookEvent = {
  eventId: string;
  type: "incoming" | "answered" | "ended" | "missed";
  from?: string;
  at?: string;
  durationSec?: number;
  callId?: string;
};

export type DispatcherView = {
  userId: string;
  role: "admin" | "dispatcher";
  status: DeskStatus;
  load: number;
};

export type TelephonyPublic = {
  connected: boolean;
  provider: string | null;
  sharedNumber: string | null;
  browserAnswer: false;
  answerHint: string;
  maxConcurrent: number;
  queueCount: number;
  queueNote: string;
  active: TelephonyCall[];
  dispatchers: DispatcherView[];
  missed: number;
  errors: TelephonyError[];
  calls: TelephonyCall[];
};
