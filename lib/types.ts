export type Role = "admin" | "dispatcher";

export type AccountStatus = "active" | "blocked";

export type WorkStatus = "idle" | "working" | "away" | "finished";

export type AttendanceType = "arrived" | "away" | "returned" | "finished";

export type SourceKind =
  | "whatsapp"
  | "telegram"
  | "instagram"
  | "site"
  | "ads"
  | "referral"
  | "other"
  | "unknown";

export type ChannelKind = "whatsapp" | "telegram" | "instagram" | "site" | "manual";

export type RequestStatus = "new" | "in_progress" | "waiting" | "done";

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  login: string;
  passwordHash: string;
  role: Role;
  accountStatus: AccountStatus;
  createdAt: string;
  scheduleStart: string | null;
};

export type AttendanceEvent = {
  id: string;
  userId: string;
  shiftId: string;
  type: AttendanceType;
  at: string;
};

export type Correction = {
  id: string;
  eventId: string;
  userId: string;
  actorId: string;
  previousAt: string;
  nextAt: string;
  reason: string;
  at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  city: string;
};

export type Conversation = {
  id: string;
  customerId: string;
  assigneeId: string | null;
  channel: ChannelKind;
  source: SourceKind;
  sourceDetail: string | null;
  status: RequestStatus;
  unread: number;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  direction: "in" | "out";
  authorId: string | null;
  text: string;
  at: string;
  delivery: "received" | "local" | "demo";
};

export type SourceChange = {
  id: string;
  conversationId: string;
  from: SourceKind;
  to: SourceKind;
  actorId: string;
  reason: string;
  at: string;
};

export type Note = {
  id: string;
  conversationId: string;
  authorId: string;
  text: string;
  at: string;
};

export type AuditEntry = {
  id: string;
  actorId: string | null;
  action: string;
  detail: string;
  targetType: string;
  targetId: string;
  at: string;
};

export type Session = {
  userId: string;
  viewAsUserId: string | null;
};

export type CrmState = {
  version: 1;
  users: User[];
  events: AttendanceEvent[];
  corrections: Correction[];
  customers: Customer[];
  conversations: Conversation[];
  messages: Message[];
  sourceChanges: SourceChange[];
  notes: Note[];
  audit: AuditEntry[];
  session: Session | null;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; code?: "confirm-finish" };

export type PeriodKind = "day" | "week" | "month";
