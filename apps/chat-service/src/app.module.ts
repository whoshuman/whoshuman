import { Module } from "@nestjs/common";
import { HelloController } from "./hello.controller";
import { ChatModule } from "./chat/chat.module";
import { PrismaModule } from "./prisma/prisma.module";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule, PrismaModule, ChatModule],
  controllers: [HelloController]
})
export class AppModule {}
