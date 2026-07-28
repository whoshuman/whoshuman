import { randomBytes } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { AuthSubjects } from "@whoshuman/shared-events";
import type {
  OAuthCallbackResponse,
  OAuthProvider,
  OAuthStartResponse
} from "@whoshuman/shared-types";
import { MessagingService } from "../common";
import { envs } from "../config";
import type { AuthUser } from "./auth-user.types";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { OAuthCompleteDto } from "./dto/oauth-complete.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const OAUTH_CALLBACK_TIMEOUT_MS = 20_000;

interface OAuthHttpRequest {
  headers: { cookie?: string };
}

interface OAuthHttpResponse {
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax";
      secure: boolean;
      maxAge: number;
      path: string;
    }
  ): void;
  clearCookie(name: string, options: { path: string }): void;
  redirect(url: string): void;
}

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

  @Get("oauth/:provider")
  async oauthStart(
    @Param("provider") providerValue: string,
    @Res() response: OAuthHttpResponse
  ): Promise<void> {
    const provider = this.provider(providerValue);
    if (!provider) {
      response.redirect(this.frontendCallback({ error: "oauthProviderInvalid" }));
      return;
    }

    const state = randomBytes(32).toString("base64url");
    response.cookie(OAUTH_STATE_COOKIE, `${provider}:${state}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: envs.oauthCookieSecure,
      maxAge: OAUTH_STATE_MAX_AGE_MS,
      path: "/"
    });

    try {
      const result = await this.messaging.request<OAuthStartResponse>(AuthSubjects.oauthStart, {
        provider,
        state
      });
      response.redirect(result.authorizationUrl);
    } catch {
      response.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
      response.redirect(this.frontendCallback({ error: "oauthProviderUnavailable" }));
    }
  }

  @Get("oauth/:provider/callback")
  async oauthCallback(
    @Param("provider") providerValue: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") providerError: string | undefined,
    @Req() request: OAuthHttpRequest,
    @Res() response: OAuthHttpResponse
  ): Promise<void> {
    const provider = this.provider(providerValue);
    const cookieState = this.cookie(request.headers.cookie, OAUTH_STATE_COOKIE);
    response.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    if (providerError) {
      response.redirect(this.frontendCallback({ error: "oauthDenied" }));
      return;
    }
    if (!provider || !state || cookieState !== `${provider}:${state}`) {
      response.redirect(this.frontendCallback({ error: "oauthStateInvalid" }));
      return;
    }
    if (!code) {
      response.redirect(this.frontendCallback({ error: "oauthCodeMissing" }));
      return;
    }

    try {
      const result = await this.messaging.request<OAuthCallbackResponse>(
        AuthSubjects.oauthCallback,
        { provider, code },
        OAUTH_CALLBACK_TIMEOUT_MS
      );
      response.redirect(
        this.frontendCallback({
          ticket: result.ticket,
          requiresDesignation: String(result.requiresDesignation),
          suggestedDesignation: result.suggestedDesignation
        })
      );
    } catch {
      response.redirect(this.frontendCallback({ error: "oauthProviderUnavailable" }));
    }
  }

  @Post("oauth/complete")
  @HttpCode(HttpStatus.OK)
  oauthComplete(@Body() dto: OAuthCompleteDto) {
    return this.messaging.request(AuthSubjects.oauthComplete, dto);
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

  private provider(value: string): OAuthProvider | null {
    return value === "google" || value === "42" ? value : null;
  }

  private cookie(header: string | undefined, name: string): string | undefined {
    const value = header
      ?.split(";")
      .map((part) => part.trim().split("="))
      .find(([key]) => key === name)
      ?.slice(1)
      .join("=");

    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  private frontendCallback(values: Record<string, string | undefined>): string {
    const url = new URL("/oauth/callback", envs.frontendUrl);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
    url.hash = params.toString();
    return url.toString();
  }
}
