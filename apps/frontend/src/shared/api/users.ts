import type { Paginated, PublicUser, UserProfile } from "@whoshuman/shared-types";
import { httpClient } from "./httpClient";

export async function getMe(): Promise<PublicUser> {
  const { data } = await httpClient.get<PublicUser>("/users/me");
  return data;
}

export interface UpdateMeInput {
  username: string;
  bio: string | null;
  avatar: string | null;
  language: string;
}

export async function updateMe(input: UpdateMeInput): Promise<PublicUser> {
  const { data } = await httpClient.put<PublicUser>("/users/me", input);
  return data;
}

// Búsqueda por username (insensible a mayúsculas), paginada. Excluye al propio usuario.
export async function searchUsers(
  search: string,
  page = 1,
  limit = 10
): Promise<Paginated<UserProfile>> {
  const { data } = await httpClient.get<Paginated<UserProfile>>("/users", {
    params: { search, page, limit }
  });
  return data;
}

// Ficha pública de otro jugador (sin email).
export async function getUser(id: string): Promise<UserProfile> {
  const { data } = await httpClient.get<UserProfile>(`/users/${id}`);
  return data;
}
