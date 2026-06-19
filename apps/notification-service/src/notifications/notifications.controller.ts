import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { NotificationSubjects } from "@whoshuman/shared-events";
import type { NotificationEnvelope } from "@whoshuman/shared-types";
import { MessagingService } from "../common";

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly messaging: MessagingService) {}

  @EventPattern(NotificationSubjects.send)
  async handleSend(@Payload() envelope: NotificationEnvelope): Promise<void> {
    if (!envelope?.recipientId) {
      this.logger.warn("Ignoring notification without recipientId");
      return;
    }
    // Pass-through: today it just forwards. Persistence / multi-channel fan-out goes here later.
    try {
      await this.messaging.publish(NotificationSubjects.deliver, envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo entregar la notificación: ${message}`);
    }
  }
}
