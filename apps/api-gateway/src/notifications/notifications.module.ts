import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MessagingService } from "../common";
import { NatsModule } from "../transports/nats.module";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [NatsModule],
  controllers: [NotificationsController],
  providers: [MessagingService, JwtAuthGuard]
})
export class NotificationsModule {}
