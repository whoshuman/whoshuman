import { Module } from "@nestjs/common";
import { FriendsModule } from "./friends/friends.module";
import { HelloController } from "./hello.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { NatsModule } from "./transports/nats.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [NatsModule, PrismaModule, FriendsModule, UsersModule],
  controllers: [HelloController]
})
export class AppModule {}
