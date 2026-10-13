export type TelephonyStatus = {
  connected: false;
  reason: string;
};

export function telephonyStatus(): TelephonyStatus {
  return {
    connected: false,
    reason: "Телефония не подключена. Входящий звонок в это окно не попадает. После разговора создайте заказ вручную.",
  };
}
