import type { FriendActionResponse, Friendship } from "@whoshuman/shared-types";
import { httpClient } from "./httpClient";

// Amistades ACEPTADAS. Cada Friendship trae en `user` al "otro" (relativo a mí).
export async function getFriends(): Promise<Friendship[]> {
  const { data } = await httpClient.get<Friendship[]>("/friends");
  return data;
}

// Solicitudes PENDIENTES entrantes (las que yo he enviado no se listan — límite del backend).
export async function getPendingRequests(): Promise<Friendship[]> {
  const { data } = await httpClient.get<Friendship[]>("/friends/requests");
  return data;
}

export async function getBlockedUsers(): Promise<Friendship[]> {
  const { data } = await httpClient.get<Friendship[]>("/friends/blocked");
  return data;
}

export async function sendFriendRequest(addresseeId: string): Promise<FriendActionResponse> {
  const { data } = await httpClient.post<FriendActionResponse>("/friends/requests", {
    addresseeId
  });
  return data;
}

export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean
): Promise<FriendActionResponse> {
  const { data } = await httpClient.post<FriendActionResponse>("/friends/requests/respond", {
    friendshipId,
    accept
  });
  return data;
}

export async function removeFriend(friendshipId: string): Promise<FriendActionResponse> {
  const { data } = await httpClient.delete<FriendActionResponse>(`/friends/${friendshipId}`);
  return data;
}

export async function blockUser(targetId: string): Promise<FriendActionResponse> {
  const { data } = await httpClient.post<FriendActionResponse>("/friends/block", { targetId });
  return data;
}

export async function unblockUser(targetId: string): Promise<FriendActionResponse> {
  const { data } = await httpClient.post<FriendActionResponse>("/friends/unblock", { targetId });
  return data;
}
