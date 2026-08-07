import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { RpcException } from "@nestjs/microservices";
import type { User } from "@prisma/client";
import type {
  OAuthCallbackResponse,
  OAuthProvider,
  OAuthStartResponse,
  AuthLogoutResponse,
  AuthRefreshResponse,
  AuthSessionResponse,
  AuthTokenPayload,
  AuthVerifyResponse,
  PublicUser
} from "@whoshuman/shared-types";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@whoshuman/shared-validation";
import * as bcrypt from "bcrypt";
import ms from "ms";
import { envs } from "../config";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { OAuthCallbackDto } from "./dto/oauth-callback.dto";
import { OAuthCompleteDto } from "./dto/oauth-complete.dto";
import { OAuthStartDto } from "./dto/oauth-start.dto";
import { RegisterDto } from "./dto/register.dto";
import { OAuthProviderService } from "./oauth-provider.service";

// ─── Constantes de seguridad ───────────────────────────────────────────────────

/**
 * Número de "rondas" de bcrypt. Cuanto más alto, más lento (y más seguro) es el
 * hash. 10 es el estándar recomendado: suficientemente costoso para frenar ataques
 * de fuerza bruta, pero rápido para el usuario al hacer login.
 */
const SALT_ROUNDS = 10;
const OAUTH_TICKET_AUDIENCE = "oauth-complete";
const OAUTH_TICKET_ISSUER = "whoshuman-auth";

interface OAuthTicketPayload {
  kind: "oauth-login";
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  avatar: string | null;
  userId?: string;
}

/**
 * AuthService concentra TODA la lógica de autenticación.
 *
 * Responsabilidades:
 *   - Hashear y verificar contraseñas (bcrypt).
 *   - Emitir y validar tokens JWT (access + refresh).
 *   - Gestionar las sesiones en BD (tabla Session) para poder invalidar tokens.
 *
 * Decisión de diseño: auth-service gestiona directamente la tabla User. No delega
 * en user-service para login/registro porque necesita el passwordHash, que NUNCA
 * debe salir de este servicio.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly oauthProvider: OAuthProviderService
  ) {}

  // ─── Helpers privados ──────────────────────────────────────────────────────────

  /**
   * Convierte un registro de usuario en su versión "pública": exactamente los
   * mismos campos MENOS el passwordHash. Es la única forma en que un usuario
   * sale de este servicio, así garantizamos que el hash nunca se filtra.
   */
  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      language: user.language,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  /**
   * Firma un ACCESS token (corta duración, ~15min). Lleva la identidad del usuario
   * en el payload y se firma con JWT_SECRET. Es el token que el frontend manda en
   * cada petición. Al ser de vida corta, limita el daño si se filtra.
   */
  private signAccessToken(payload: AuthTokenPayload) {
    const options: JwtSignOptions = {
      secret: envs.jwtSecret,
      expiresIn: envs.jwtExpiresIn
    };
    return this.jwt.sign(payload, options);
  }

  /**
   * Firma un REFRESH token (larga duración, ~7días). Lleva el id del usuario y un
   * "jti" (JWT ID) aleatorio único, y se firma con un secreto DISTINTO
   * (JWT_REFRESH_SECRET). Usar dos secretos separados evita que un access token
   * robado pueda usarse como refresh y viceversa.
   *
   * El jti es IMPRESCINDIBLE: sin él, dos refresh tokens del mismo usuario emitidos
   * en el mismo segundo serían idénticos (mismo sub/iat/exp) y chocarían contra la
   * constraint UNIQUE de la columna refreshToken en BD.
   */
  private signRefreshToken(payload: { sub: string }) {
    const options: JwtSignOptions = {
      secret: envs.jwtRefreshSecret,
      expiresIn: envs.jwtRefreshExpiresIn,
      jwtid: randomUUID()
    };
    return this.jwt.sign(payload, options);
  }

  /**
   * Crea una nueva sesión: genera un refresh token y lo guarda en BD con su fecha
   * de expiración. Guardar el refresh token en BD es lo que nos permite INVALIDARLO
   * (en logout o al rotarlo). Sin esta tabla, un JWT sería imposible de revocar.
   */
  private async createSession(userId: string) {
    const refreshToken = this.signRefreshToken({ sub: userId });
    const refreshExpiresMs = ms(envs.jwtRefreshExpiresIn);
    const expiresAt = new Date(Date.now() + refreshExpiresMs);

    await this.prisma.session.create({
      data: { userId, refreshToken, expiresAt }
    });

    return refreshToken;
  }

  private async authSession(user: User): Promise<AuthSessionResponse> {
    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username
    });
    const refreshToken = await this.createSession(user.id);
    return {
      user: this.toPublicUser(user),
      tokens: { accessToken, refreshToken }
    };
  }

  private signOAuthTicket(payload: OAuthTicketPayload): string {
    return this.jwt.sign(payload, {
      secret: envs.jwtRefreshSecret,
      expiresIn: "5m",
      audience: OAUTH_TICKET_AUDIENCE,
      issuer: OAUTH_TICKET_ISSUER,
      jwtid: randomUUID()
    });
  }

  private verifyOAuthTicket(ticket: string): OAuthTicketPayload {
    try {
      const payload = this.jwt.verify<OAuthTicketPayload>(ticket, {
        secret: envs.jwtRefreshSecret,
        audience: OAUTH_TICKET_AUDIENCE,
        issuer: OAUTH_TICKET_ISSUER
      });
      if (payload.kind !== "oauth-login") throw new Error("Wrong ticket kind");
      return payload;
    } catch {
      throw new RpcException({ statusCode: 401, message: "oauthTicketInvalid" });
    }
  }

  // ─── Métodos públicos ──────────────────────────────────────────────────────────

  /**
   * REGISTRO: crea una cuenta nueva.
   * 1. Comprueba que el email y el username no estén ya cogidos.
   * 2. Hashea la contraseña (nunca se guarda en texto plano).
   * 3. Crea el usuario y abre su primera sesión.
   * 4. Devuelve el usuario público + el par de tokens.
   */
  async register(dto: RegisterDto): Promise<AuthSessionResponse> {
    // Un único query con OR detecta colisión de email O de username.
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] }
    });

    if (existing) {
      throw new RpcException({
        statusCode: 409,
        // Devolvemos una CLAVE de traducción, no texto. El api-gateway la localiza.
        message: existing.email === dto.email ? "emailInUse" : "usernameTaken"
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const language =
      dto.language &&
      SUPPORTED_LANGUAGES.includes(dto.language as (typeof SUPPORTED_LANGUAGES)[number])
        ? dto.language
        : DEFAULT_LANGUAGE;

    const user = await this.prisma.user.create({
      data: { email: dto.email, username: dto.username, passwordHash, language }
    });

    return this.authSession(user);
  }

  /**
   * LOGIN: valida credenciales y abre sesión.
   *
   * SEGURIDAD: si el email no existe o la contraseña es incorrecta, devolvemos
   * SIEMPRE el mismo mensaje genérico ("Invalid credentials"). Así un atacante no
   * puede averiguar qué emails están registrados (evita user enumeration).
   */
  async login(dto: LoginDto): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      throw new RpcException({ statusCode: 401, message: "invalidCredentials" });
    }

    // bcrypt.compare vuelve a hashear la contraseña recibida con el mismo salt
    // y compara — nunca desencripta el hash guardado (bcrypt es de un solo sentido).
    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      throw new RpcException({ statusCode: 401, message: "invalidCredentials" });
    }

    return this.authSession(user);
  }

  oauthStart(dto: OAuthStartDto): OAuthStartResponse {
    return {
      authorizationUrl: this.oauthProvider.authorizationUrl(dto.provider, dto.state)
    };
  }

  async oauthCallback(dto: OAuthCallbackDto): Promise<OAuthCallbackResponse> {
    const identity = await this.oauthProvider.exchangeCode(dto.provider, dto.code);
    const account = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: identity.provider,
          providerAccountId: identity.providerAccountId
        }
      },
      include: { user: true }
    });
    const emailUser = account
      ? null
      : await this.prisma.user.findUnique({ where: { email: identity.email } });
    const user = account?.user ?? emailUser;
    if (user?.deletedAt) {
      throw new RpcException({ statusCode: 401, message: "userNotFound" });
    }

    return {
      ticket: this.signOAuthTicket({
        kind: "oauth-login",
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
        email: identity.email,
        avatar: identity.avatar,
        userId: user?.id
      }),
      requiresDesignation: !user,
      suggestedDesignation: user ? undefined : identity.suggestedDesignation
    };
  }

  async oauthComplete(dto: OAuthCompleteDto): Promise<AuthSessionResponse> {
    const ticket = this.verifyOAuthTicket(dto.ticket);
    const linkedAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: ticket.provider,
          providerAccountId: ticket.providerAccountId
        }
      },
      include: { user: true }
    });
    if (linkedAccount) {
      if (linkedAccount.user.deletedAt) {
        throw new RpcException({ statusCode: 401, message: "userNotFound" });
      }
      return this.authSession(linkedAccount.user);
    }

    let user = ticket.userId
      ? await this.prisma.user.findUnique({ where: { id: ticket.userId } })
      : await this.prisma.user.findUnique({ where: { email: ticket.email } });

    if (user) {
      if (user.deletedAt) {
        throw new RpcException({ statusCode: 401, message: "userNotFound" });
      }
      await this.prisma.oAuthAccount.create({
        data: {
          provider: ticket.provider,
          providerAccountId: ticket.providerAccountId,
          userId: user.id
        }
      });
      return this.authSession(user);
    }

    const username = dto.username?.trim();
    if (!username || username.length < 3 || username.length > 20) {
      throw new RpcException({ statusCode: 400, message: "oauthDesignationRequired" });
    }
    const usernameTaken = await this.prisma.user.findUnique({ where: { username } });
    if (usernameTaken) {
      throw new RpcException({ statusCode: 409, message: "usernameTaken" });
    }

    const passwordHash = await bcrypt.hash(randomUUID(), SALT_ROUNDS);
    const language =
      dto.language &&
      SUPPORTED_LANGUAGES.includes(dto.language as (typeof SUPPORTED_LANGUAGES)[number])
        ? dto.language
        : DEFAULT_LANGUAGE;
    user = await this.prisma.user.create({
      data: {
        email: ticket.email,
        username,
        passwordHash,
        avatar: ticket.avatar,
        language,
        oauthAccounts: {
          create: {
            provider: ticket.provider,
            providerAccountId: ticket.providerAccountId
          }
        }
      }
    });

    return this.authSession(user);
  }

  /**
   * REFRESH: renueva el access token cuando caduca, sin pedir login otra vez.
   *
   * SEGURIDAD — rotación de refresh tokens: cada vez que se usa un refresh token,
   * lo BORRAMOS y emitimos uno nuevo. Si un atacante roba un refresh token y la
   * víctima lo usa antes, el del atacante deja de funcionar (y al revés). Esto
   * detecta y corta el reuso de tokens robados.
   */
  async refresh(refreshToken: string): Promise<AuthRefreshResponse> {
    const session = await this.prisma.session.findUnique({ where: { refreshToken } });

    // La sesión no existe (token falso o ya rotado) o ha expirado.
    if (!session || session.expiresAt < new Date()) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new RpcException({ statusCode: 401, message: "refreshInvalid" });
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });

    if (!user) {
      throw new RpcException({ statusCode: 401, message: "userNotFound" });
    }

    // Rotación: invalidamos la sesión actual y abrimos una nueva.
    await this.prisma.session.delete({ where: { id: session.id } });
    const newRefreshToken = await this.createSession(user.id);
    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      username: user.username
    });

    return { tokens: { accessToken, refreshToken: newRefreshToken } };
  }

  /**
   * LOGOUT: cierra la sesión borrando el refresh token de la BD.
   *
   * Tras esto el refresh token queda invalidado inmediatamente (no se puede renovar).
   * NOTA: el access token ya emitido sigue siendo válido hasta que caduca (máx 15min);
   * esto es inherente a los JWT stateless y es un riesgo aceptado a cambio de no tener
   * que consultar la BD en cada petición.
   */
  async logout(refreshToken: string): Promise<AuthLogoutResponse> {
    const session = await this.prisma.session.findUnique({ where: { refreshToken } });

    if (!session) {
      throw new RpcException({ statusCode: 404, message: "sessionNotFound" });
    }

    await this.prisma.session.delete({ where: { id: session.id } });

    return { success: true };
  }

  /**
   * VERIFY: comprueba si un access token es válido (firma correcta + no caducado).
   * Lo usará el api-gateway para proteger rutas antes de hacer proxy.
   * Devuelve { valid: false } en vez de lanzar error: validar un token inválido
   * es un resultado normal, no una excepción.
   */
  verify(token: string): AuthVerifyResponse {
    // jwt.verify es SÍNCRONO (no toca la BD), por eso este método no es async.
    try {
      const payload = this.jwt.verify<AuthTokenPayload>(token, {
        secret: envs.jwtSecret
      });
      return {
        valid: true,
        payload: { sub: payload.sub, email: payload.email, username: payload.username }
      };
    } catch {
      return { valid: false };
    }
  }
}
