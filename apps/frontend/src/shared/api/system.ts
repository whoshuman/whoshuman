import { httpClient } from "./httpClient";

// Ping de salud que el gateway reenvía por NATS a cada microservicio.
// Si el servicio no responde en 3s el gateway devuelve 504.
export interface ServiceHealth {
  service: string;
  message: string;
  transport: string;
  timestamp: string;
}

export const MONITORED_SERVICES = [
  "auth",
  "users",
  "game",
  "matchmaking",
  "chat",
  "notifications",
  "realtime"
] as const;

export type MonitoredService = (typeof MONITORED_SERVICES)[number];

export async function getServiceHealth(name: MonitoredService): Promise<ServiceHealth> {
  const { data } = await httpClient.get<ServiceHealth>(`/hello/${name}`);
  return data;
}
