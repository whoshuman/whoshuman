import { Controller, Inject, Logger } from "@nestjs/common";
import { ClientProxy, EventPattern, Payload } from "@nestjs/microservices";
import { NotificationSubjects } from "@whoshuman/shared-events";
import type { NotificationEnvelope } from "@whoshuman/shared-types";
import { NATS_SERVICE } from "../config";

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  @EventPattern(NotificationSubjects.send)
  handleSend(@Payload() envelope: NotificationEnvelope) {
    if (!envelope?.recipientId) {
      this.logger.warn("Ignoring notification without recipientId");
      return;
    }
    // Pass-through: today it just forwards. Persistence / multi-channel fan-out goes here later.
    this.client.emit(NotificationSubjects.deliver, envelope);
  }
}
