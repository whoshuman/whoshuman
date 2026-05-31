import { Module } from "@nestjs/common";
import { HelloController } from "./hello.controller";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [NatsModule],
  controllers: [HelloController]
})
export class AppModule {}
