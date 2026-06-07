import { Module } from "@nestjs/common";
import { HelloController } from "./hello.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule, NotificationsModule],
  controllers: [HelloController]
})
export class AppModule {}
