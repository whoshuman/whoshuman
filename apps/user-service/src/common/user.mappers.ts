import type { User } from "@prisma/client";
import type { NotificationActor, PublicUser, UserProfile } from "@whoshuman/shared-types";

/**
 * Proyección pública de la tabla User (lo que devuelve un `select` sin email).
 * La usan las queries de perfil público y búsqueda.
 */
export type PublicUserRow = {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  createdAt: Date;
};

/**
 * Mappers de User → tipos compartidos. Viven aquí (y no en cada service) porque
 * tanto el módulo de amigos como el de usuarios los necesitan: si mañana cambia
 * `PublicUser`, se toca UN sitio. Nunca exponen el passwordHash.
 */

/** Versión completa del usuario (CON email). Solo para el propio usuario (/me). */
export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    avatar: u.avatar,
    bio: u.bio,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString()
  };
}

/** Perfil público (SIN email). Para terceros y resultados de búsqueda. */
export function toUserProfile(u: PublicUserRow): UserProfile {
  return {
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    bio: u.bio,
    createdAt: u.createdAt.toISOString()
  };
}

/** Actor mínimo para notificaciones (SIN email): quién originó el aviso. */
export function toActor(u: User): NotificationActor {
  return { id: u.id, username: u.username, avatar: u.avatar };
}
