import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthSubjects } from "@whoshuman/shared-events";
import type { AuthVerifyResponse } from "@whoshuman/shared-types";
import { I18nContext } from "nestjs-i18n";
import { MessagingService } from "../../common";
import type { AuthenticatedRequest } from "../auth-user.types";

/**
 * JwtAuthGuard protege las rutas que lo usan (@UseGuards(JwtAuthGuard)).
 *
 * Antes de que la petición llegue al controller:
 *   1. Extrae el access token de la cabecera "Authorization: Bearer <token>".
 *   2. Pregunta al auth-service (auth.verify) si el token es válido.
 *   3. Si es válido, adjunta el usuario a request.user y deja pasar.
 *   4. Si no, lanza 401 y la petición nunca llega al controller.
 *
 * Así el controller puede asumir que, si se ejecuta, el usuario está autenticado.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly messaging: MessagingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    const result = await this.messaging.request<AuthVerifyResponse>(AuthSubjects.verify, { token });

    if (!result.valid || !result.payload) {
      throw new UnauthorizedException(this.translate("tokenInvalidOrExpired"));
    }

    // Dejamos el usuario disponible para el controller (vía @CurrentUser()).
    request.user = result.payload;
    return true;
  }

  /** Extrae el token de "Authorization: Bearer <token>". Lanza 401 si falta o es inválido. */
  private extractToken(request: AuthenticatedRequest): string {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException(this.translate("tokenMissing"));
    }

    return token;
  }

  /** Traduce una clave de error al idioma de la petición actual. */
  private translate(key: string): string {
    const i18n = I18nContext.current();
    if (!i18n) return key;
    return i18n.t(`errors.${key}`, { defaultValue: key });
  }
}
