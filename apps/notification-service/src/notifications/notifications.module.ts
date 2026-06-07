import { Module } from "@nestjs/common";
import { NatsModule } from "../transports/nats.module";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [NatsModule],
  controllers: [NotificationsController]
})
export class NotificationsModule {}
