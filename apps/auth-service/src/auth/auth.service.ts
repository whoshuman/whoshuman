import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { RpcException } from "@nestjs/microservices";
import * as bcrypt from "bcrypt";
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

/**
 * Convierte duraciones tipo JWT_REFRESH_EXPIRES_IN ("15m", "7d", "1h") a ms para
 * calcular expiresAt en BD con la misma configuración usada al firmar el JWT.
 */
function expirationToMs(value: string) {
  const match = value.trim().match(/^(\d+)(ms|s|m|h|d|w)?$/);

  if (!match) {
    throw new Error(`Invalid token expiration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

// Tipo mínimo del usuario tal como viene de Prisma (lo que necesitamos exponer).
interface UserRecord {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
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
    private readonly jwt: JwtService
  ) {}

  // ─── Helpers privados ──────────────────────────────────────────────────────────

  /**
   * Convierte un registro de usuario en su versión "pública": exactamente los
   * mismos campos MENOS el passwordHash. Es la única forma en que un usuario
   * sale de este servicio, así garantizamos que el hash nunca se filtra.
   */
  private toPublicUser(user: UserRecord) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Firma un ACCESS token (corta duración, ~15min). Lleva la identidad del usuario
   * en el payload y se firma con JWT_SECRET. Es el token que el frontend manda en
   * cada petición. Al ser de vida corta, limita el daño si se filtra.
   */
  private signAccessToken(payload: { sub: string; email: string; username: string }) {
    // El cast a JwtSignOptions es necesario porque @nestjs/jwt tipa expiresIn con un
    // tipo especial del paquete "ms" (ej. "15m"), no con un string genérico. Nuestros
    // valores vienen del .env validados como string, así que el cast es seguro.
    const options: JwtSignOptions = {
      secret: envs.jwtSecret,
      expiresIn: envs.jwtExpiresIn
    } as JwtSignOptions;
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
    } as JwtSignOptions;
    return this.jwt.sign(payload, options);
  }

  /**
   * Crea una nueva sesión: genera un refresh token y lo guarda en BD con su fecha
   * de expiración. Guardar el refresh token en BD es lo que nos permite INVALIDARLO
   * (en logout o al rotarlo). Sin esta tabla, un JWT sería imposible de revocar.
   */
  private async createSession(userId: string) {
    const refreshToken = this.signRefreshToken({ sub: userId });
    const expiresAt = new Date(Date.now() + expirationToMs(envs.jwtRefreshExpiresIn));

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
  async register(dto: RegisterDto) {
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
  async login(dto: LoginDto) {
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
  async refresh(refreshToken: string) {
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
  async logout(refreshToken: string) {
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
  verify(token: string): {
    valid: boolean;
    payload?: { sub: string; email: string; username: string };
  } {
    // jwt.verify es SÍNCRONO (no toca la BD), por eso este método no es async.
    try {
      const payload = this.jwt.verify<{ sub: string; email: string; username: string }>(token, {
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
