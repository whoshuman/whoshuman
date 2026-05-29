import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./gateways/realtime.gateway";
import { HelloController } from "./hello.controller";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule],
  controllers: [HelloController],
  providers: [RealtimeGateway]
})
export class AppModule {}
