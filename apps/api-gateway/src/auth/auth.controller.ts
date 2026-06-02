import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { AuthSubjects } from "@whoshuman/shared-events";
import { MessagingService } from "../common";
import type { AuthUser } from "./auth-user.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

/**
 * AuthController es el "puente HTTP→NATS" para autenticación.
 *
 * Recibe peticiones HTTP del frontend (POST /auth/login, etc.), valida el body con
 * los DTOs, y reenvía la petición al auth-service por NATS usando MessagingService.
 * La respuesta del microservicio se devuelve tal cual al cliente como JSON.
 *
 * El frontend SOLO ve esta capa HTTP; nunca toca NATS directamente.
 *
 * Rutas PÚBLICAS (sin token): register, login, refresh, logout.
 * Rutas PROTEGIDAS (con Bearer token): profile, mediante JwtAuthGuard.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly messaging: MessagingService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.messaging.request(AuthSubjects.register, dto);
  }

  // 200 en vez del 201 por defecto: login no "crea" un recurso, autentica.
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.messaging.request(AuthSubjects.login, dto);
  }

  // refresh y logout son públicos porque usan el refresh token (no el access),
  // que puede estar ya caducado cuando se llaman.
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.messaging.request(AuthSubjects.refresh, dto);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto) {
    return this.messaging.request(AuthSubjects.logout, dto);
  }

  /**
   * GET /auth/profile — ruta PROTEGIDA.
   *
   * El JwtAuthGuard valida el token (Authorization: Bearer ...) ANTES de entrar aquí.
   * Si llegamos a ejecutar este método, el usuario ya está autenticado y @CurrentUser()
   * nos da su identidad directamente desde el token, sin otra llamada a la BD.
   */
  @Get("profile")
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
