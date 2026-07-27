import { Module } from "@nestjs/common";
import { MessagingService } from "./common/messaging.service";
import { GameController } from "./game/game.controller";
import { GameService } from "./game/game.service";
import { HelloController } from "./hello.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule, PrismaModule],
  controllers: [HelloController, GameController],
  providers: [MessagingService, GameService]
})
export class AppModule {}
