import { Module } from "@nestjs/common";
import { MessagingService } from "../common";
import { NatsModule } from "../transports/nats.module";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [NatsModule],
  controllers: [NotificationsController],
  providers: [MessagingService]
})
export class NotificationsModule {}
