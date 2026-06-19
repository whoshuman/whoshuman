import { Module } from "@nestjs/common";
import { MessagingService } from "../common";
import { NatsModule } from "../transports/nats.module";
import { FriendsController } from "./friends.controller";
import { FriendsService } from "./friends.service";

@Module({
  imports: [NatsModule],
  controllers: [FriendsController],
  providers: [FriendsService, MessagingService]
})
export class FriendsModule {}
