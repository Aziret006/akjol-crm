export type PlatformRole = "owner" | "sysadmin" | "support" | "finance";

export type CompanyStatus = "active" | "trial" | "awaiting_payment" | "suspended" | "closed";

export type PlanPeriod = "trial" | "month" | "year" | "custom";

export type SubscriptionStatus = "trial" | "active" | "expiring" | "overdue" | "cancelled";

export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";

export type AgentStatus = "active" | "stopped" | "setup" | "error" | "offline";

export type IntegrationKind = "whatsapp" | "telegram";

export type IntegrationStatus = "connected" | "error" | "disconnected" | "pending";

export type TicketStatus = "new" | "in_progress" | "waiting_client" | "resolved" | "closed";

export type TicketPriority = "low" | "normal" | "high";

export type NoticeLevel = "info" | "warning" | "critical";

export type PlatformPermission =
  | "platform.view"
  | "companies.view"
  | "companies.edit"
  | "users.view"
  | "users.edit"
  | "plans.view"
  | "plans.edit"
  | "finance.view"
  | "agents.view"
  | "agents.control"
  | "integrations.view"
  | "integrations.control"
  | "support.view"
  | "support.reply"
  | "notices.view"
  | "journal.view"
  | "roles.view";

export type Plan = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: "KGS";
  period: PlanPeriod;
  staffLimit: number;
  channelLimit: number;
  features: string[];
  aiDialogLimit: number;
  available: boolean;
};

export type Company = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  status: CompanyStatus;
  planId: string;
  ownerUserId: string;
  createdAt: string;
  note: string;
  demo: true;
};

export type TenantUser = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  accountStatus: "active" | "blocked";
  createdAt: string;
  lastSeenAt: string | null;
};

export type Subscription = {
  id: string;
  companyId: string;
  planId: string;
  period: PlanPeriod;
  status: SubscriptionStatus;
  startedAt: string;
  endsAt: string;
  amount: number;
  paid: boolean;
};

export type Payment = {
  id: string;
  companyId: string;
  planId: string;
  amount: number;
  currency: "KGS";
  at: string;
  method: "bank" | "card" | "transfer" | "unknown";
  status: PaymentStatus;
  providerRef: string | null;
  note: string;
};

export type Agent = {
  id: string;
  companyId: string;
  name: string;
  status: AgentStatus;
  channels: IntegrationKind[];
  dialogs: number;
  errors: number;
  lastActiveAt: string | null;
  configNote: string;
};

export type Integration = {
  id: string;
  companyId: string;
  kind: IntegrationKind;
  status: IntegrationStatus;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  autoReplies: boolean;
};

export type TicketMessage = {
  id: string;
  author: string;
  staff: boolean;
  text: string;
  at: string;
};

export type Ticket = {
  id: string;
  number: number;
  companyId: string;
  userId: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string | null;
  createdAt: string;
  lastReplyAt: string;
  messages: TicketMessage[];
};

export type Notice = {
  id: string;
  category: string;
  level: NoticeLevel;
  title: string;
  text: string;
  at: string;
  href: string;
  read: boolean;
};

export type JournalEntry = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  object: string;
  result: "ok" | "denied" | "error";
  reason: string;
  at: string;
};

export type Operator = {
  userId: string;
  role: PlatformRole;
};

export type AgentError = {
  id: string;
  agentId: string;
  at: string;
  text: string;
};

export type PlatformState = {
  version: 1;
  source: "demo";
  plans: Plan[];
  companies: Company[];
  users: TenantUser[];
  subscriptions: Subscription[];
  payments: Payment[];
  agents: Agent[];
  agentErrors: AgentError[];
  integrations: Integration[];
  tickets: Ticket[];
  notices: Notice[];
  journal: JournalEntry[];
  operators: Operator[];
};

export type PlatformAction =
  | { type: "set-company-status"; companyId: string; status: CompanyStatus; reason: string }
  | { type: "set-company-plan"; companyId: string; planId: string; reason: string }
  | { type: "set-user-status"; userId: string; accountStatus: "active" | "blocked"; reason: string }
  | { type: "set-user-role"; userId: string; role: string; reason: string }
  | { type: "save-plan"; plan: Plan }
  | { type: "set-agent-status"; agentId: string; status: AgentStatus }
  | { type: "set-integration"; integrationId: string; status: IntegrationStatus }
  | { type: "check-integration"; integrationId: string }
  | { type: "reply-ticket"; ticketId: string; text: string }
  | { type: "set-ticket"; ticketId: string; status?: TicketStatus; priority?: TicketPriority; assignee?: string | null }
  | { type: "read-notice"; noticeId: string | "all" }
  | { type: "revoke-sessions"; userId: string };
