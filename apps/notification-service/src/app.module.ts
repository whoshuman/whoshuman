import { Module } from "@nestjs/common";
import { HelloController } from "./hello.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule, PrismaModule, NotificationsModule],
  controllers: [HelloController]
})
export class AppModule {}
