import type {
  ActionResponse,
  NotificationRecord,
  NotificationUnreadCount
} from "@whoshuman/shared-types";
import { httpClient } from "./httpClient";

export async function getNotifications(): Promise<NotificationRecord[]> {
  const { data } = await httpClient.get<NotificationRecord[]>("/notifications");
  return data;
}

export async function getUnreadNotificationCount(): Promise<NotificationUnreadCount> {
  const { data } = await httpClient.get<NotificationUnreadCount>("/notifications/unread-count");
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<ActionResponse> {
  const { data } = await httpClient.patch<ActionResponse>(`/notifications/${notificationId}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<ActionResponse> {
  const { data } = await httpClient.patch<ActionResponse>("/notifications/read-all");
  return data;
}
