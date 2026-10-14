import { demoDrivers } from "./drivers";
import { normalizeCustomer } from "./orders";
import type { AttendanceEvent, AttendanceType, Conversation, CrmState, Message, User } from "./types";
import { addDays, bishkekDateString, isoAt } from "./time";

const HASH = {
  admin: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
  aigul: "a5bce6fa6aace629f73dc2089cd268cd1dd5144dbb77acf0c0c1de3aa580a2fa",
  nurlan: "ece680423e38a8e6b684576860d1a39112f85b7c24e43ccd9bece7bc8a17e56f",
  elina: "92efdab55c2ec32f3224993e34f86bb5b607090c94e7738b9ee4206c5126e096",
  bekzat: "6cef88e9e89b08a782acdff7fc97a803ff9c9d88a37dc339c16a430669de98ea",
  samara: "9ef100006f200f87ab417abbd87c2eeee16e6f1e491c2337c082411a2cadad6d",
};

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function user(
  partial: Pick<User, "id" | "firstName" | "lastName" | "login" | "role"> &
    Partial<Pick<User, "accountStatus" | "scheduleStart">> & { daysAgo: number; hash: string },
): User {
  const today = bishkekDateString();
  return {
    id: partial.id,
    firstName: partial.firstName,
    lastName: partial.lastName,
    login: partial.login,
    passwordHash: partial.hash,
    role: partial.role,
    accountStatus: partial.accountStatus ?? "active",
    createdAt: isoAt(addDays(today, -partial.daysAgo), "10:00"),
    scheduleStart: partial.scheduleStart ?? null,
  };
}

function closedShift(
  userId: string,
  date: string,
  start: string,
  away: string,
  back: string,
  end: string,
): AttendanceEvent[] {
  const shiftId = `shift-${userId}-${date}`;
  const steps: [string, AttendanceType][] = [
    [start, "arrived"],
    [away, "away"],
    [back, "returned"],
    [end, "finished"],
  ];
  return steps.map(([time, type], index) => ({
    id: `${shiftId}-${index}`,
    userId,
    shiftId,
    type,
    at: isoAt(date, time),
  }));
}

function todayShift(userId: string, steps: [string, AttendanceType][]): AttendanceEvent[] {
  const today = bishkekDateString();
  const shiftId = `shift-${userId}-${today}`;
  const events: AttendanceEvent[] = [];
  for (let index = 0; index < steps.length; index += 1) {
    const at = isoAt(today, steps[index][0]);
    if (new Date(at).getTime() > Date.now()) break;
    events.push({ id: `${shiftId}-${index}`, userId, shiftId, type: steps[index][1], at });
  }
  return events;
}

function conversation(
  partial: Omit<Conversation, "unread"> & { unread?: number },
): Conversation {
  return { unread: 0, ...partial };
}

function message(
  id: string,
  conversationId: string,
  direction: "in" | "out",
  authorId: string | null,
  text: string,
  at: string,
): Message {
  return {
    id,
    conversationId,
    direction,
    authorId,
    text,
    at,
    delivery: direction === "in" ? "received" : "demo",
  };
}

export const DEMO_LOGINS = [
  { login: "admin", password: "admin", name: "Азамат Токтогулов", role: "Администратор" },
  { login: "aigul", password: "aigul", name: "Айгуль Сатыбалдиева", role: "Диспетчер" },
  { login: "nurlan", password: "nurlan", name: "Нурлан Беков", role: "Диспетчер" },
];

export function createSeed(): CrmState {
  const today = bishkekDateString();
  const yesterday = addDays(today, -1);

  const users: User[] = [
    user({ id: "u-admin", firstName: "Азамат", lastName: "Токтогулов", login: "admin", role: "admin", daysAgo: 60, hash: HASH.admin }),
    user({ id: "u-aigul", firstName: "Айгуль", lastName: "Сатыбалдиева", login: "aigul", role: "dispatcher", daysAgo: 40, hash: HASH.aigul, scheduleStart: "09:00" }),
    user({ id: "u-nurlan", firstName: "Нурлан", lastName: "Беков", login: "nurlan", role: "dispatcher", daysAgo: 28, hash: HASH.nurlan, scheduleStart: "09:00" }),
    user({ id: "u-elina", firstName: "Элина", lastName: "Касымова", login: "elina", role: "dispatcher", daysAgo: 21, hash: HASH.elina, scheduleStart: "09:00" }),
    user({ id: "u-bekzat", firstName: "Бекзат", lastName: "Усенов", login: "bekzat", role: "dispatcher", daysAgo: 14, hash: HASH.bekzat, scheduleStart: "10:00" }),
    user({
      id: "u-samara",
      firstName: "Самара",
      lastName: "Алиева",
      login: "samara",
      role: "dispatcher",
      daysAgo: 12,
      hash: HASH.samara,
      accountStatus: "blocked",
      scheduleStart: "09:00",
    }),
  ];

  const patterns = [
    { id: "u-aigul", start: "08:50", away: "13:00", back: "13:35", end: "18:05" },
    { id: "u-nurlan", start: "09:22", away: "12:40", back: "13:15", end: "18:00" },
    { id: "u-elina", start: "08:40", away: "14:00", back: "14:25", end: "17:50" },
    { id: "u-bekzat", start: "10:05", away: "15:00", back: "15:20", end: "19:00" },
  ];

  const events: AttendanceEvent[] = [];
  for (let day = 1; day <= 10; day += 1) {
    const date = addDays(today, -day);
    for (const pattern of patterns) {
      events.push(...closedShift(pattern.id, date, pattern.start, pattern.away, pattern.back, pattern.end));
    }
  }
  events.push(
    ...todayShift("u-aigul", [
      ["08:52", "arrived"],
      ["12:18", "away"],
      ["13:02", "returned"],
    ]),
    ...todayShift("u-nurlan", [
      ["09:18", "arrived"],
      ["14:40", "away"],
    ]),
    ...todayShift("u-elina", [
      ["08:40", "arrived"],
      ["12:00", "away"],
      ["12:28", "returned"],
      ["15:40", "finished"],
    ]),
  );

  const customers = [
    { id: "cust-meerim", name: "Мээрим Толонова", phone: "+996 700 11 20 01", city: "Бишкек" },
    { id: "cust-aibek", name: "Айбек Жумабеков", phone: "+996 700 11 20 02", city: "Бишкек" },
    { id: "cust-marina", name: "Марина Ким", phone: "+996 555 11 20 03", city: "Бишкек" },
    { id: "cust-taalay", name: "Таалай Молдоев", phone: "+996 700 11 20 04", city: "Кант" },
    { id: "cust-janyl", name: "Жаныл Асанова", phone: "+996 700 11 20 05", city: "Бишкек" },
    { id: "cust-oleg", name: "Олег Петров", phone: "+996 555 11 20 06", city: "Бишкек" },
    { id: "cust-sanzhar", name: "Санжар Исаев", phone: "+996 700 11 20 07", city: "Бишкек" },
    { id: "cust-asel", name: "Асель Рыскулова", phone: "+996 700 11 20 08", city: "Токмок" },
    { id: "cust-ermek", name: "Эрмек Садыков", phone: "+996 555 11 20 09", city: "Бишкек" },
  ];

  const conversations: Conversation[] = [
    conversation({
      id: "c-meerim",
      customerId: "cust-meerim",
      assigneeId: "u-aigul",
      channel: "whatsapp",
      source: "whatsapp",
      sourceDetail: null,
      status: "done",
      createdAt: ago(420),
      updatedAt: ago(415),
    }),
    conversation({
      id: "c-aibek",
      customerId: "cust-aibek",
      assigneeId: "u-aigul",
      channel: "whatsapp",
      source: "whatsapp",
      sourceDetail: null,
      status: "in_progress",
      unread: 1,
      createdAt: ago(300),
      updatedAt: ago(40),
    }),
    conversation({
      id: "c-marina",
      customerId: "cust-marina",
      assigneeId: null,
      channel: "whatsapp",
      source: "unknown",
      sourceDetail: null,
      status: "new",
      unread: 1,
      createdAt: ago(50),
      updatedAt: ago(50),
    }),
    conversation({
      id: "c-taalay",
      customerId: "cust-taalay",
      assigneeId: "u-nurlan",
      channel: "site",
      source: "site",
      sourceDetail: "форма на akjol.kg",
      status: "waiting",
      createdAt: ago(240),
      updatedAt: ago(229),
    }),
    conversation({
      id: "c-janyl",
      customerId: "cust-janyl",
      assigneeId: "u-elina",
      channel: "manual",
      source: "referral",
      sourceDetail: "рекомендация, без рекламной метки",
      status: "done",
      createdAt: isoAt(yesterday, "16:10"),
      updatedAt: isoAt(yesterday, "16:24"),
    }),
    conversation({
      id: "c-oleg",
      customerId: "cust-oleg",
      assigneeId: "u-aigul",
      channel: "telegram",
      source: "telegram",
      sourceDetail: null,
      status: "in_progress",
      createdAt: ago(180),
      updatedAt: ago(175),
    }),
    conversation({
      id: "c-sanzhar",
      customerId: "cust-sanzhar",
      assigneeId: "u-bekzat",
      channel: "site",
      source: "ads",
      sourceDetail: "utm_source=yandex",
      status: "new",
      unread: 1,
      createdAt: ago(500),
      updatedAt: ago(500),
    }),
    conversation({
      id: "c-asel",
      customerId: "cust-asel",
      assigneeId: "u-nurlan",
      channel: "whatsapp",
      source: "whatsapp",
      sourceDetail: null,
      status: "in_progress",
      createdAt: ago(90),
      updatedAt: ago(78),
    }),
    conversation({
      id: "c-ermek",
      customerId: "cust-ermek",
      assigneeId: null,
      channel: "instagram",
      source: "instagram",
      sourceDetail: null,
      status: "new",
      unread: 1,
      createdAt: ago(120),
      updatedAt: ago(120),
    }),
    conversation({
      id: "c-aibek-old",
      customerId: "cust-aibek",
      assigneeId: "u-aigul",
      channel: "whatsapp",
      source: "whatsapp",
      sourceDetail: null,
      status: "done",
      createdAt: isoAt(yesterday, "11:00"),
      updatedAt: isoAt(yesterday, "11:12"),
    }),
    conversation({
      id: "c-week",
      customerId: "cust-taalay",
      assigneeId: "u-nurlan",
      channel: "site",
      source: "site",
      sourceDetail: null,
      status: "done",
      createdAt: isoAt(addDays(today, -8), "12:00"),
      updatedAt: isoAt(addDays(today, -8), "12:20"),
    }),
    conversation({
      id: "c-month",
      customerId: "cust-sanzhar",
      assigneeId: "u-elina",
      channel: "site",
      source: "ads",
      sourceDetail: "utm_source=yandex",
      status: "done",
      createdAt: isoAt(addDays(today, -20), "09:30"),
      updatedAt: isoAt(addDays(today, -20), "09:48"),
    }),
    conversation({
      id: "c-unknown-old",
      customerId: "cust-marina",
      assigneeId: null,
      channel: "whatsapp",
      source: "unknown",
      sourceDetail: null,
      status: "new",
      unread: 1,
      createdAt: isoAt(addDays(today, -3), "18:05"),
      updatedAt: isoAt(addDays(today, -3), "18:05"),
    }),
  ];

  const messages: Message[] = [
    message("m1", "c-meerim", "in", null, "Здравствуйте, хочу подключиться к парку.", ago(420)),
    message("m2", "c-meerim", "out", "u-aigul", "Готово, вы в парке. Хорошей смены.", ago(415)),
    message("m3", "c-aibek", "in", null, "Здравствуйте, хочу работать на своём авто.", ago(300)),
    message("m4", "c-aibek", "out", "u-aigul", "Здравствуйте! Напишите город и год выпуска автомобиля.", ago(296)),
    message("m5", "c-aibek", "in", null, "Бишкек, Toyota 2018.", ago(280)),
    message("m6", "c-aibek", "in", null, "И какая комиссия?", ago(40)),
    message("m7", "c-marina", "in", null, "Добрый день, есть свободные места?", ago(50)),
    message("m8", "c-taalay", "in", null, "Оставил заявку на сайте, жду звонка.", ago(240)),
    message("m9", "c-taalay", "out", "u-nurlan", "Таалай, заявку вижу. Перезвоним сегодня.", ago(229)),
    message("m10", "c-janyl", "in", null, "Меня посоветовала сестра, хочу подключиться.", isoAt(yesterday, "16:10")),
    message("m11", "c-janyl", "out", "u-elina", "Записали вас. Добро пожаловать в Акжол.", isoAt(yesterday, "16:24")),
    message("m12", "c-oleg", "in", null, "Можно выйти на линию сегодня?", ago(180)),
    message("m13", "c-oleg", "out", "u-aigul", "Да. Пришлите фото прав в этот чат.", ago(175)),
    message("m14", "c-sanzhar", "in", null, "Заявка с рекламы. Грузовик, 2 тонны.", ago(500)),
    message("m15", "c-asel", "in", null, "Не пришла выплата за вчера.", ago(90)),
    message("m16", "c-asel", "out", "u-nurlan", "Проверяю. Напишите номер карты.", ago(78)),
    message("m17", "c-ermek", "in", null, "Как подключиться? Пишу из Instagram.", ago(120)),
    message("m18", "c-aibek-old", "in", null, "Подскажите адрес офиса.", isoAt(yesterday, "11:00")),
    message("m19", "c-aibek-old", "out", "u-aigul", "Бишкек, ответили вчера и закрыли вопрос.", isoAt(yesterday, "11:12")),
    message("m20", "c-week", "in", null, "Повторная заявка с сайта.", isoAt(addDays(today, -8), "12:00")),
    message("m21", "c-week", "out", "u-nurlan", "Приняли, подключим в тот же день.", isoAt(addDays(today, -8), "12:20")),
    message("m22", "c-month", "in", null, "Видел рекламу, хочу в парк.", isoAt(addDays(today, -20), "09:30")),
    message("m23", "c-month", "out", "u-elina", "Заявку с меткой yandex приняли.", isoAt(addDays(today, -20), "09:48")),
    message("m24", "c-unknown-old", "in", null, "Кто на связи?", isoAt(addDays(today, -3), "18:05")),
  ];

  return {
    version: 1,
    users,
    events,
    corrections: [],
    customers: customers.map((item) => normalizeCustomer(item)),
    conversations,
    messages,
    sourceChanges: [
      {
        id: "src-1",
        conversationId: "c-janyl",
        from: "unknown",
        to: "referral",
        actorId: "u-admin",
        reason: "Клиент сам назвал рекомендацию, рекламной метки не было",
        at: isoAt(yesterday, "16:20"),
      },
    ],
    notes: [
      {
        id: "note-1",
        conversationId: "c-aibek",
        authorId: "u-aigul",
        text: "Авто 2018 года, Бишкек. Ждёт ответ по комиссии.",
        at: ago(270),
      },
    ],
    drivers: demoDrivers(),
    driverTasks: [],
    driverNotes: [],
    ratings: [],
    orders: [],
    orderEvents: [],
    audit: [
      {
        id: "audit-seed-1",
        actorId: "u-admin",
        action: "Сотрудник создан",
        detail: "Самара Алиева, роль диспетчер",
        targetType: "user",
        targetId: "u-samara",
        at: isoAt(addDays(today, -12), "10:05"),
      },
      {
        id: "audit-seed-2",
        actorId: "u-admin",
        action: "Аккаунт заблокирован",
        detail: "Самара Алиева",
        targetType: "user",
        targetId: "u-samara",
        at: isoAt(addDays(today, -2), "18:40"),
      },
      {
        id: "audit-seed-3",
        actorId: "u-admin",
        action: "Источник изменён",
        detail: "Жаныл Асанова: Не определён → Рекомендация",
        targetType: "conversation",
        targetId: "c-janyl",
        at: isoAt(yesterday, "16:20"),
      },
    ],
    session: null,
  };
}
