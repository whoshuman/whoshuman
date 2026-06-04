import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { RpcException } from "@nestjs/microservices";
import type {
  AuthLogoutResponse,
  AuthRefreshResponse,
  AuthSessionResponse,
  AuthTokenPayload,
  AuthVerifyResponse,
  PublicUser
} from "@whoshuman/shared-types";
import * as bcrypt from "bcrypt";
import ms from "ms";
import { envs } from "../config";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

// ─── Constantes de seguridad ───────────────────────────────────────────────────

/**
 * Número de "rondas" de bcrypt. Cuanto más alto, más lento (y más seguro) es el
 * hash. 10 es el estándar recomendado: suficientemente costoso para frenar ataques
 * de fuerza bruta, pero rápido para el usuario al hacer login.
 */
const SALT_ROUNDS = 10;

type UserRecord = Omit<PublicUser, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

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
    private readonly jwt: JwtService
  ) {}

  // ─── Helpers privados ──────────────────────────────────────────────────────────

  /**
   * Convierte un registro de usuario en su versión "pública": exactamente los
   * mismos campos MENOS el passwordHash. Es la única forma en que un usuario
   * sale de este servicio, así garantizamos que el hash nunca se filtra.
   */
  private toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
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

    const user = await this.prisma.user.create({
      data: { email: dto.email, username: dto.username, passwordHash }
    });

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
