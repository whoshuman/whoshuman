import { Module } from "@nestjs/common";
import { FriendsModule } from "./friends/friends.module";
import { HelloController } from "./hello.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule, PrismaModule, FriendsModule],
  controllers: [HelloController]
})
export class AppModule {}
