import type { PublicUser } from "@whoshuman/shared-types";
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
