import type { User } from "@prisma/client";
import type { NotificationActor, PublicUser, UserProfile } from "@whoshuman/shared-types";

/**
 * Proyección pública de la tabla User (lo que devuelve un `select` sin email).
 * Se deriva de UserProfile (misma forma, pero con la fecha cruda de la BD) para
 * no repetir los campos: si UserProfile cambia, este tipo se actualiza solo.
 */
export type PublicUserRow = Omit<UserProfile, "createdAt"> & { createdAt: Date };

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
