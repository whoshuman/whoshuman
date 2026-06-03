import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest, AuthUser } from "../auth-user.types";

/**
 * @CurrentUser() inyecta el usuario autenticado en un parámetro del controller.
 *
 * Lee request.user, que el JwtAuthGuard rellenó tras validar el token. Solo tiene
 * sentido en rutas protegidas por JwtAuthGuard; si no, devolvería undefined.
 *
 * Uso:  profile(@CurrentUser() user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  }
);
