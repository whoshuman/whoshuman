import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./gateways/realtime.gateway";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule],
  providers: [RealtimeGateway]
})
export class AppModule {}
