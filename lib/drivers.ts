import type { Driver } from "./types";
import { addDays, bishkekDateString, isoAt } from "./time";

export function demoDrivers(now = new Date()): Driver[] {
  const createdAt = isoAt(addDays(bishkekDateString(now), -30), "10:00");
  return [
    {
      id: "drv-kubat",
      firstName: "Кубат",
      lastName: "Асанов",
      phone: "+996 555 20 01 01",
      availability: "available",
      vehicle: "01 123 ABC · Toyota",
      note: "Демо-водитель",
      createdAt,
    },
    {
      id: "drv-nursultan",
      firstName: "Нурсултан",
      lastName: "Исаев",
      phone: "+996 700 20 01 02",
      availability: "available",
      vehicle: "01 456 DEF · Hyundai",
      note: "Демо-водитель",
      createdAt,
    },
    {
      id: "drv-timur",
      firstName: "Тимур",
      lastName: "Садыков",
      phone: "+996 700 20 01 04",
      availability: "available",
      vehicle: null,
      note: "Демо-водитель, автомобиль не закреплён",
      createdAt,
    },
    {
      id: "drv-azamat",
      firstName: "Азамат",
      lastName: "Керимбеков",
      phone: "+996 555 20 01 03",
      availability: "offline",
      vehicle: "02 789 GHI · Kia",
      note: "Демо-водитель, не на линии",
      createdAt,
    },
  ];
}
