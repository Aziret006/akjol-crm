"use client";

import { useState } from "react";
import { Button, Modal, controlClass } from "@/components/ui";
import { platformAllows } from "@/lib/platform/access";
import { usePlatform } from "@/lib/platform/client";
import { CHANNEL_LABEL, INTEGRATION_STATUS_LABEL } from "@/lib/platform/labels";
import type { IntegrationKind, IntegrationStatus } from "@/lib/platform/types";
import { formatDateTime } from "@/lib/time";
import { Confirm, EmptyBox, Pager, Pill } from "./widgets";

export function IntegrationsScreen() {
  const { state, role, run } = usePlatform();
  const [kind, setKind] = useState<"all" | IntegrationKind>("all");
  const [status, setStatus] = useState<"all" | IntegrationStatus>("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (!platformAllows(role, "integrations.view")) return <EmptyBox>Недостаточно прав</EmptyBox>;
  const canControl = platformAllows(role, "integrations.control");
  const rows = state.integrations.filter((item) => (kind === "all" || item.kind === kind) && (status === "all" || item.status === status));
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const slice = rows.slice((page - 1) * 8, page * 8);
  const opened = state.integrations.find((item) => item.id === openId) ?? null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#667085]">WhatsApp Cloud API и Telegram не подключены. Переписки и токены не показываются. Успешную синхронизацию система не имитирует.</p>
      {message ? <p className="text-sm text-[#b45309]">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <select className={`${controlClass} w-auto`} value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setPage(1); }}>
          <option value="all">Все каналы</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="telegram">Telegram</option>
        </select>
        <select className={`${controlClass} w-auto`} value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
          <option value="all">Все статусы</option>
          {(Object.keys(INTEGRATION_STATUS_LABEL) as IntegrationStatus[]).map((item) => <option key={item} value={item}>{INTEGRATION_STATUS_LABEL[item]}</option>)}
        </select>
      </div>
      <section className="crm-panel overflow-x-auto">
        {slice.length === 0 ? <EmptyBox>Интеграций нет</EmptyBox> : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#f7f8fa] text-[#667085]">
              <tr>{["Компания", "Канал", "Статус", "Подключение", "Синхронизация", "Ошибка", ""].map((title) => <th key={title || "a"} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody>
              {slice.map((item) => {
                const company = state.companies.find((row) => row.id === item.companyId);
                return (
                  <tr key={item.id} className="border-t border-[#e6e8ec]">
                    <td className="px-3 py-2">{company?.name}</td>
                    <td className="px-3 py-2">{CHANNEL_LABEL[item.kind]}</td>
                    <td className="px-3 py-2"><Pill text={INTEGRATION_STATUS_LABEL[item.status]} tone={item.status === "connected" ? "green" : item.status === "error" ? "rose" : "gray"} /></td>
                    <td className="px-3 py-2">{item.connectedAt ? formatDateTime(item.connectedAt) : "—"}</td>
                    <td className="px-3 py-2">{item.lastSyncAt ? formatDateTime(item.lastSyncAt) : "—"}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-[#b45309]">{item.lastError ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" className="h-8" onClick={() => setOpenId(item.id)}>Подробности</Button>
                        <Button variant="secondary" className="h-8" onClick={async () => { const result = await run({ type: "check-integration", integrationId: item.id }); setMessage(result.error || "Проверка записана"); }}>Проверить</Button>
                        {canControl && item.status !== "disconnected" ? <Button variant="danger" className="h-8" onClick={() => setDisableId(item.id)}>Отключить</Button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pager page={page} pages={pages} onPage={setPage} />
      </section>
      {opened ? (
        <Modal title={`${CHANNEL_LABEL[opened.kind]} · журнал`} onClose={() => setOpenId(null)}>
          <p className="text-sm">Автоответы: {opened.autoReplies ? "включены в карточке" : "выключены"}</p>
          <p className="mt-2 text-sm text-[#667085]">{opened.lastError || "Ошибок нет"}</p>
          <p className="mt-3 text-xs text-[#98a2b3]">Секреты подключения и переписки скрыты.</p>
        </Modal>
      ) : null}
      {disableId ? (
        <Confirm
          title="Отключить интеграцию?"
          text="Токены не удаляются из env: их там нет. Статус в демо-хранилище станет «отключена»."
          confirmLabel="Отключить"
          onClose={() => setDisableId(null)}
          onConfirm={async () => {
            const result = await run({ type: "set-integration", integrationId: disableId, status: "disconnected" });
            setMessage(result.ok ? "Интеграция отключена в демо-хранилище" : result.error);
            setDisableId(null);
          }}
        />
      ) : null}
    </div>
  );
}
