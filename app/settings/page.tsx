"use client";

import { useState } from "react";
import { Button, NoAccess } from "@/components/ui";
import { useCrm } from "@/lib/store";

const ENV_VARS = [
  ["WHATSAPP_ACCESS_TOKEN", "Токен доступа Cloud API"],
  ["WHATSAPP_PHONE_NUMBER_ID", "ID номера WhatsApp"],
  ["WHATSAPP_BUSINESS_ACCOUNT_ID", "ID бизнес-аккаунта"],
  ["WHATSAPP_VERIFY_TOKEN", "Проверка webhook"],
  ["WHATSAPP_APP_SECRET", "Подпись входящих запросов"],
  ["WHATSAPP_WEBHOOK_URL", "Адрес приёма входящих сообщений"],
];

export default function SettingsPage() {
  const crm = useCrm();
  const [confirm, setConfirm] = useState(false);
  if (!crm.isAdmin) return <NoAccess />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="crm-panel p-5">
        <p className="text-xs text-[#828b95]">WhatsApp</p>
        <h2 className="mt-1 text-xl font-semibold">Не подключено</h2>
        <p className="mt-2 text-sm text-[#6b6560]">
          Для живых переписок нужен WhatsApp Business Platform / Cloud API или разрешённый провайдер. Кнопка «подключить» без ключей не включается, чтобы не создавать ложный статус доставки.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {ENV_VARS.map(([name, hint]) => (
            <li key={name} className="rounded-xl bg-[#faf8f4] px-3 py-2">
              <code className="font-semibold">{name}</code>
              <span className="mt-0.5 block text-[#6b6560]">{hint}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[#6b6560]">Секреты хранятся только в переменных окружения сервера. В браузер они не попадают.</p>
      </section>
      <section className="space-y-4">
        <article className="crm-panel p-5">
          <h2 className="font-semibold">Компания</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-[#6b6560]">Название</dt><dd>Акжол таксопарк</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#6b6560]">Часовой пояс</dt><dd>Asia/Bishkek</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#6b6560]">Хранение</dt><dd>Локально в браузере</dd></div>
          </dl>
        </article>
        <article className="crm-panel p-5">
          <h2 className="font-semibold">Демонстрационные данные</h2>
          <p className="mt-2 text-sm text-[#6b6560]">Сброс вернёт тестовых сотрудников и обращения. Ваша сессия администратора сохранится.</p>
          {confirm ? (
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={() => { crm.resetDemo(); setConfirm(false); }}>Подтвердить сброс</Button>
              <Button variant="secondary" onClick={() => setConfirm(false)}>Отмена</Button>
            </div>
          ) : <Button className="mt-3" variant="secondary" onClick={() => setConfirm(true)}>Сбросить локальные данные</Button>}
        </article>
      </section>
    </div>
  );
}
