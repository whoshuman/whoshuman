import { Controller, Logger } from "@nestjs/common";
import { EventPattern, MessagePattern, Payload } from "@nestjs/microservices";
import { NotificationSubjects } from "@whoshuman/shared-events";
import type {
  MarkNotificationReadPayload,
  NotificationEnvelope,
  UserScopedPayload
} from "@whoshuman/shared-types";
import { NotificationsService } from "./notifications.service";

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notifications: NotificationsService) {}

  @EventPattern(NotificationSubjects.send)
  async handleSend(@Payload() envelope: NotificationEnvelope): Promise<void> {
    if (!envelope?.recipientId) {
      this.logger.warn("Ignoring notification without recipientId");
      return;
    }
    try {
      await this.notifications.storeAndDeliver(envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo guardar o entregar la notificación: ${message}`);
    }
  }

  @MessagePattern(NotificationSubjects.list)
  list(@Payload() payload: UserScopedPayload) {
    return this.notifications.list(payload);
  }

  @MessagePattern(NotificationSubjects.unreadCount)
  unreadCount(@Payload() payload: UserScopedPayload) {
    return this.notifications.unreadCount(payload);
  }

  @MessagePattern(NotificationSubjects.markRead)
  markRead(@Payload() payload: MarkNotificationReadPayload) {
    return this.notifications.markRead(payload);
  }

  @MessagePattern(NotificationSubjects.markAllRead)
  markAllRead(@Payload() payload: UserScopedPayload) {
    return this.notifications.markAllRead(payload);
  }
}
