import { Module } from "@nestjs/common";
import { MessagingService } from "../common";
import { NatsModule } from "../transports/nats.module";
import { FriendsController } from "./friends.controller";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Module({
  imports: [NatsModule],
  controllers: [FriendsController],
  providers: [MessagingService, JwtAuthGuard]
})
export class FriendsModule {}
