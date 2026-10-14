export type Stage = "new" | "call" | "docs" | "check" | "activation" | "first_order";

export type StatusKey =
  | "need_call"
  | "in_progress"
  | "await_docs"
  | "on_check"
  | "ready"
  | "done_order"
  | "problem"
  | "no_answer"
  | "attention";

export type DemoDriver = {
  id: string;
  name: string;
  phone: string;
  stage: Stage;
  status: StatusKey;
  date: string;
  next: string;
  nextSub: string;
  mine: boolean;
  avatar: string;
};

export type DemoTask = {
  id: string;
  time: string;
  title: string;
  person: string;
  tone: "red" | "amber" | "blue" | "green";
  note?: string;
};

export const STAGE_ORDER: Stage[] = ["new", "call", "docs", "check", "activation", "first_order"];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "Новая заявка",
  call: "Звонок",
  docs: "Документы",
  check: "Проверка СРМК",
  activation: "Активация",
  first_order: "1-й заказ",
};

export const FUNNEL = [
  { stage: "new" as Stage, title: "Новые заявки", count: 12, hint: "Нужно связаться", color: "#2f6bf0" },
  { stage: "call" as Stage, title: "Звонок", count: 8, hint: "В процессе", color: "#2457cf" },
  { stage: "docs" as Stage, title: "Документы", count: 6, hint: "Ожидают / на проверке", color: "#1d47ae" },
  { stage: "check" as Stage, title: "Проверка СРМК", count: 4, hint: "На проверке", color: "#193b92" },
  { stage: "activation" as Stage, title: "Активация", count: 3, hint: "Готов к работе", color: "#163a86" },
  { stage: "first_order" as Stage, title: "1-й заказ", count: 8, hint: "Выполнили заказ", color: "#1f8f58" },
];

export const STATUS: Record<StatusKey, { label: string; bg: string; text: string }> = {
  need_call: { label: "Нужно позвонить", bg: "#3a2a0b", text: "#f5b73b" },
  in_progress: { label: "В процессе", bg: "#132c5c", text: "#6aa3ff" },
  await_docs: { label: "Ожидает документы", bg: "#132c5c", text: "#6aa3ff" },
  on_check: { label: "На проверке", bg: "#2a1d5c", text: "#b08cff" },
  ready: { label: "Готов к работе", bg: "#0f3a26", text: "#4ade80" },
  done_order: { label: "Выполнил заказ", bg: "#0f3a26", text: "#4ade80" },
  problem: { label: "Проблема", bg: "#4a1519", text: "#ff6b6b" },
  no_answer: { label: "Не дозвонились", bg: "#1f2838", text: "#a6b0c3" },
  attention: { label: "Требует внимания", bg: "#3a2a0b", text: "#f5b73b" },
};

export const DRIVERS: DemoDriver[] = [
  { id: "d1", name: "Сериков А.", phone: "+7 707 123 45 67", stage: "new", status: "need_call", date: "12.03 10:15", next: "Позвонить", nextSub: "До 12:00", mine: true, avatar: "#5b7cfa" },
  { id: "d2", name: "Ибраимов К.", phone: "+7 778 234 56 78", stage: "call", status: "in_progress", date: "12.03 09:42", next: "Перезвонить", nextSub: "Сегодня 12:00", mine: true, avatar: "#c08457" },
  { id: "d3", name: "Тулегенов М.", phone: "+7 701 345 67 89", stage: "docs", status: "await_docs", date: "12.03 09:30", next: "Напомнить о доках", nextSub: "Сегодня 14:00", mine: true, avatar: "#7b8aa6" },
  { id: "d4", name: "Кайрат Н.", phone: "+7 775 456 78 90", stage: "check", status: "on_check", date: "12.03 08:55", next: "Проверить статус", nextSub: "Сегодня 13:00", mine: true, avatar: "#4f9d8c" },
  { id: "d5", name: "Жумабек Д.", phone: "+7 700 567 89 01", stage: "activation", status: "ready", date: "12.03 08:20", next: "Активировать", nextSub: "Сегодня 11:00", mine: true, avatar: "#b56a7e" },
  { id: "d6", name: "Нургалиев Е.", phone: "+7 771 678 90 12", stage: "first_order", status: "done_order", date: "12.03 08:10", next: "Поздравить", nextSub: "и проинформировать", mine: false, avatar: "#6f8fb3" },
  { id: "d7", name: "Асанов Б.", phone: "+7 706 789 01 23", stage: "docs", status: "problem", date: "12.03 07:50", next: "Не отвечает", nextSub: "Повторный позвонить", mine: true, avatar: "#8f6f5a" },
  { id: "d8", name: "Маматов С.", phone: "+7 777 890 12 34", stage: "call", status: "no_answer", date: "12.03 07:30", next: "Повторный звонок", nextSub: "Сегодня 16:00", mine: false, avatar: "#a07a4e" },
  { id: "d9", name: "Османов Т.", phone: "+7 778 901 23 45", stage: "check", status: "attention", date: "12.03 07:10", next: "Уточнить данные", nextSub: "Сегодня 15:00", mine: true, avatar: "#5d8f6b" },
  { id: "d10", name: "Алиев Д.", phone: "+7 701 234 56 78", stage: "new", status: "need_call", date: "12.03 07:00", next: "Позвонить", nextSub: "Сегодня 11:00", mine: false, avatar: "#6b7fd6" },
];

export const TASKS: DemoTask[] = [
  { id: "t1", time: "11:50", title: "Перезвонить Серикову А.", person: "", tone: "red", note: "Истекло 20 минут" },
  { id: "t2", time: "12:00", title: "Напомнить документы", person: "Ибраимов К.", tone: "amber" },
  { id: "t3", time: "13:00", title: "Проверить статус СРМК", person: "Тулегенов М.", tone: "blue" },
  { id: "t4", time: "14:00", title: "Активировать как водителя", person: "Кайрат Н.", tone: "green" },
  { id: "t5", time: "15:00", title: "Повторный звонок", person: "Асанов Б.", tone: "red" },
];

export const RECENT = [
  { id: "r1", name: "Сериков А.", date: "12.03 10:15", stage: "new" as Stage, avatar: "#5b7cfa" },
  { id: "r2", name: "Ибраимов К.", date: "12.03 09:42", stage: "call" as Stage, avatar: "#c08457" },
  { id: "r3", name: "Тулегенов М.", date: "12.03 09:30", stage: "docs" as Stage, avatar: "#7b8aa6" },
  { id: "r4", name: "Кайрат Н.", date: "12.03 08:55", stage: "check" as Stage, avatar: "#4f9d8c" },
  { id: "r5", name: "Жумабек Д.", date: "12.03 08:20", stage: "activation" as Stage, avatar: "#b56a7e" },
];

export const NOTICES = [
  { id: "n1", time: "10:45", title: "Сериков А.", text: "Нужно перезвонить (истекло 20 минут)", tone: "red" as const },
  { id: "n2", time: "09:30", title: "Документы загружены", text: "Тулегенов М.", tone: "blue" as const },
  { id: "n3", time: "09:15", title: "1-й заказ выполнен", text: "Жумабек Д.", tone: "green" as const },
  { id: "n4", time: "08:50", title: "Не отвечает", text: "Асанов Б. (попытка 2 раза)", tone: "red" as const },
];

export const CHART = [
  { hour: "09", calls: 3, regs: 1, orders: 0 },
  { hour: "10", calls: 2, regs: 1, orders: 1 },
  { hour: "11", calls: 2, regs: 0, orders: 1 },
  { hour: "12", calls: 6, regs: 3, orders: 1 },
  { hour: "13", calls: 1, regs: 1, orders: 0 },
  { hour: "14", calls: 3, regs: 1, orders: 1 },
  { hour: "15", calls: 2, regs: 2, orders: 1 },
  { hour: "16", calls: 1, regs: 1, orders: 0 },
  { hour: "17", calls: 3, regs: 2, orders: 1 },
  { hour: "18", calls: 1, regs: 1, orders: 0 },
];

export const STAGE_PILL: Record<Stage, { bg: string; text: string }> = {
  new: { bg: "#132c5c", text: "#6aa3ff" },
  call: { bg: "#132c5c", text: "#6aa3ff" },
  docs: { bg: "#132c5c", text: "#6aa3ff" },
  check: { bg: "#2a1d5c", text: "#b08cff" },
  activation: { bg: "#0f3a26", text: "#4ade80" },
  first_order: { bg: "#0f3a26", text: "#4ade80" },
};
