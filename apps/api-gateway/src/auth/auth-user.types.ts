import type { AuthTokenPayload } from "@whoshuman/shared-types";

/**
 * Datos del usuario autenticado que el JwtAuthGuard extrae del access token
 * y adjunta a la petición. Coincide con el payload que firma el auth-service.
 */
export type AuthUser = AuthTokenPayload;

/**
 * Forma mínima de la petición HTTP que necesitan el guard y el decorador.
 * Tras pasar por JwtAuthGuard, `user` queda relleno.
 */
export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthUser;
}
