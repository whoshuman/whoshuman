import { Module } from "@nestjs/common";
import { MessagingService } from "./common/messaging.service";
import { RealtimeGateway } from "./gateways/realtime.gateway";
import { RealtimeAuthService } from "./gateways/realtime-auth.service";
import { RealtimeEventsController } from "./gateways/realtime-events.controller";
import { RealtimeRoomsService } from "./gateways/realtime-rooms.service";
import { HelloController } from "./hello.controller";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule],
  controllers: [HelloController, RealtimeEventsController],
  providers: [MessagingService, RealtimeAuthService, RealtimeRoomsService, RealtimeGateway]
})
export class AppModule {}
