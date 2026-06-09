import { Module } from "@nestjs/common";
import { MessagingService } from "./common/messaging.service";
import { HelloController } from "./hello.controller";
import { MatchmakingController } from "./matchmaking/matchmaking.controller";
import { MatchmakingService } from "./matchmaking/matchmaking.service";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule],
  controllers: [HelloController, MatchmakingController],
  providers: [MessagingService, MatchmakingService]
})
export class AppModule {}
