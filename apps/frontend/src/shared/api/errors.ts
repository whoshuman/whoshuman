import { isAxiosError } from "axios";

/** Extrae un mensaje legible del error de la API (el back ya lo manda traducido). */
export function apiError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join(", ");
  }
  return fallback;
}
