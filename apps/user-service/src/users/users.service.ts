import { Injectable } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { paginate } from "@whoshuman/shared-utils";
import { SUPPORTED_LANGUAGES } from "@whoshuman/shared-validation";
import type {
  ActionResponse,
  Paginated,
  PublicUser,
  SearchUsersPayload,
  UpdateProfilePayload,
  UserProfile,
  UserScopedPayload
} from "@whoshuman/shared-types";
import { toPublicUser, toUserProfile, type PublicUserRow } from "../common";
import { PrismaService } from "../prisma/prisma.service";

// Campos que se exponen de OTROS usuarios (perfil público y búsqueda).
// El email queda fuera a propósito: solo el propio usuario lo ve (findMe).
const PUBLIC_SELECT = {
  id: true,
  username: true,
  avatar: true,
  bio: true,
  createdAt: true
} as const;

/**
 * UsersService concentra el CRUD de perfiles.
 *
 * Reglas clave:
 *   - TODAS las lecturas y escrituras filtran `deletedAt: null`: una cuenta con
 *     borrado lógico no existe de cara a la API (aunque su access token siga
 *     vivo unos minutos tras borrarse — los JWT no se pueden revocar).
 *   - El perfil propio (findMe) lleva email; el público (findProfile/search) no.
 *     Son métodos separados a propósito: así no hay lógica condicional que
 *     pueda filtrar el email por error.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private fail(statusCode: number, message: string): never {
    throw new RpcException({ statusCode, message });
  }

  /** Perfil PROPIO (con email). 404 si no existe o está borrado. */
  async findMe(payload: UserScopedPayload): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null }
    });
    if (!user) this.fail(404, "userNotFound");
    return toPublicUser(user);
  }

  /** Perfil PÚBLICO de cualquier usuario (sin email). 404 si no existe o está borrado. */
  async findProfile(payload: UserScopedPayload): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
      select: PUBLIC_SELECT
    });
    if (!user) this.fail(404, "userNotFound");
    return toUserProfile(user);
  }

  /**
   * Reemplaza los campos editables del perfil (semántica PUT).
   * El email NO se toca: es fijo y su gestión pertenece a auth-service.
   */
  async updateProfile(payload: UpdateProfilePayload): Promise<PublicUser> {
    const { userId, username, avatar, bio, language } = payload;

    // Una cuenta borrada no puede editarse: sin esto, alguien con un token aún
    // válido tras borrarse podría renombrar su tombstone y romper la anonimización.
    const me = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null }
    });
    if (!me) this.fail(404, "userNotFound");

    // Si el idioma no está soportado, se conserva el actual en vez de fallar.
    const lang = SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])
      ? language
      : me.language;

    // No-op: si el body trae exactamente los valores actuales, no ejecutamos el
    // UPDATE. Así `updatedAt` solo cambia con ediciones REALES (Prisma lo bumpea
    // en cada update aunque los datos sean idénticos). Aprovechamos el `me` que
    // ya leímos para el check del tombstone — cero queries extra.
    if (
      me.username === username &&
      me.avatar === avatar &&
      me.bio === bio &&
      me.language === lang
    ) {
      return toPublicUser(me);
    }

    // Unicidad de username contra OTROS usuarios. No hace falta excluir borrados:
    // sus usernames están anonimizados (deleted_<id>), nunca chocan con uno real.
    const clash = await this.prisma.user.findFirst({
      where: { username, id: { not: userId } }
    });
    if (clash) this.fail(409, "usernameTaken");

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { username, avatar, bio, language: lang }
    });
    return toPublicUser(user);
  }

  /**
   * Borrado LÓGICO con anonimización, en una transacción:
   *   1. Borra las sesiones (logout forzado: sin refresh posible).
   *   2. Borra sus amistades (desaparece de las listas de los demás).
   *   3. Marca `deletedAt` y reescribe email/username a un centinela único
   *      (libera los valores reales y elimina el PII — GDPR).
   * La fila User se CONSERVA (tombstone) y los Scores también: el historial de
   * partidas de otros jugadores no se rompe.
   */
  async deleteAccount(payload: UserScopedPayload): Promise<ActionResponse> {
    const { userId } = payload;
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.friendship.deleteMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] }
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          // El id (uuid) garantiza que el centinela nunca choca con el @unique.
          email: `deleted_${userId}@deleted.local`,
          username: `deleted_${userId}`,
          avatar: null,
          bio: null
        }
      })
    ]);
    return { success: true };
  }

  /** Búsqueda paginada por username (parcial, sin mayúsculas). Nunca devuelve borrados. */
  async searchUsers(payload: SearchUsersPayload): Promise<Paginated<UserProfile>> {
    const where = {
      deletedAt: null,
      // Quien busca no aparece en sus propios resultados (el search sirve para
      // encontrar a OTROS, p.ej. para enviarles solicitud de amistad).
      id: { not: payload.userId },
      ...(payload.query
        ? { username: { contains: payload.query, mode: "insensitive" as const } }
        : {})
    };
    const result = await paginate<PublicUserRow>(payload, {
      findMany: (skip, take) =>
        this.prisma.user.findMany({
          where,
          orderBy: { username: "asc" },
          skip,
          take,
          select: PUBLIC_SELECT
        }),
      count: () => this.prisma.user.count({ where })
    });
    return { data: result.data.map((u) => toUserProfile(u)), meta: result.meta };
  }
}
