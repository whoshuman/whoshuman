import { Module } from "@nestjs/common";
import { NatsModule } from "../transports/nats.module";
import { FriendsController } from "./friends.controller";
import { FriendsService } from "./friends.service";

@Module({
  imports: [NatsModule],
  controllers: [FriendsController],
  providers: [FriendsService]
})
export class FriendsModule {}
