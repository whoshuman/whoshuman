import { Module } from "@nestjs/common";
import { MessagingService } from "../common";
import { NatsModule } from "../transports/nats.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [NatsModule],
  controllers: [NotificationsController],
  providers: [MessagingService, NotificationsService]
})
export class NotificationsModule {}
