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

export type OrderSource = "phone" | "whatsapp" | "telegram" | "site" | "other";

export type OrderStatus =
  | "new"
  | "processing"
  | "awaiting_driver"
  | "assigned"
  | "en_route"
  | "in_progress"
  | "done"
  | "cancelled";

export type OrderHold = "callback" | "no_driver" | "no_answer" | "needs_admin" | "await_confirm";

export type OrderPriority = "normal" | "high";

export type PaymentMethod = "cash" | "card" | "transfer";

export type DriverAvailability = "available" | "offline";

export type DriverDuty = "available" | "busy" | "offline";

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

export type Driver = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  availability: DriverAvailability;
  vehicle: string | null;
  note: string;
  createdAt: string;
};

export type Order = {
  id: string;
  number: number;
  customerId: string;
  pickup: string;
  dropoff: string;
  pickupAt: string | null;
  comment: string;
  passengers: number | null;
  payment: PaymentMethod | null;
  price: number | null;
  source: OrderSource;
  status: OrderStatus;
  driverId: string | null;
  dispatcherId: string;
  conversationId: string | null;
  cancelReason: string;
  callId?: string | null;
  priority: OrderPriority;
  hold: OrderHold | null;
  callbackAt: string | null;
  vehicleNote: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderEvent = {
  id: string;
  orderId: string;
  actorId: string;
  kind: "created" | "assigned" | "status" | "cancelled" | "reopened" | "hold" | "dispatcher";
  detail: string;
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
  drivers: Driver[];
  orders: Order[];
  orderEvents: OrderEvent[];
  session: Session | null;
};

export type ActionResult =
  | { ok: true; orderId?: string }
  | { ok: false; error: string; code?: "confirm-finish" | "duplicate-order"; orderId?: string };

export type PeriodKind = "day" | "week" | "month";
