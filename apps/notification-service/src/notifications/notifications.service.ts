import { Injectable } from "@nestjs/common";
import type { Notification, Prisma } from "@prisma/client";
import { NotificationSubjects } from "@whoshuman/shared-events";
import type {
  ActionResponse,
  MarkNotificationReadPayload,
  NotificationEnvelope,
  NotificationRecord,
  NotificationUnreadCount,
  UserScopedPayload
} from "@whoshuman/shared-types";
import { MessagingService } from "../common";
import { PrismaService } from "../prisma/prisma.service";

const HISTORY_LIMIT = 50;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService
  ) {}

  async storeAndDeliver(envelope: NotificationEnvelope): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: envelope.recipientId,
        type: envelope.type,
        actorId: envelope.from.id,
        actorUsername: envelope.from.username,
        actorAvatar: envelope.from.avatar,
        ...(envelope.data !== undefined ? { data: envelope.data as Prisma.InputJsonValue } : {})
      }
    });

    await this.messaging.publish(NotificationSubjects.deliver, this.toRecord(notification));
  }

  async list(payload: UserScopedPayload): Promise<NotificationRecord[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId: payload.userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT
    });

    return notifications.map((notification) => this.toRecord(notification));
  }

  async unreadCount(payload: UserScopedPayload): Promise<NotificationUnreadCount> {
    const count = await this.prisma.notification.count({
      where: { recipientId: payload.userId, readAt: null }
    });
    return { count };
  }

  async markRead(payload: MarkNotificationReadPayload): Promise<ActionResponse> {
    await this.prisma.notification.updateMany({
      where: {
        id: payload.notificationId,
        recipientId: payload.userId,
        readAt: null
      },
      data: { readAt: new Date() }
    });
    return { success: true };
  }

  async markAllRead(payload: UserScopedPayload): Promise<ActionResponse> {
    await this.prisma.notification.updateMany({
      where: { recipientId: payload.userId, readAt: null },
      data: { readAt: new Date() }
    });
    return { success: true };
  }

  private toRecord(notification: Notification): NotificationRecord {
    const data =
      notification.data &&
      typeof notification.data === "object" &&
      !Array.isArray(notification.data)
        ? (notification.data as Record<string, unknown>)
        : undefined;

    return {
      id: notification.id,
      recipientId: notification.recipientId,
      type: notification.type as NotificationRecord["type"],
      from: {
        id: notification.actorId,
        username: notification.actorUsername,
        avatar: notification.actorAvatar
      },
      ...(data ? { data } : {}),
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString()
    };
  }
}
