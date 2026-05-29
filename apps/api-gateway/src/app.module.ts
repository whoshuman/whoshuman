import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { envs } from "./config";
import { HelloController } from "./hello.controller";
import { NatsModule } from "./transports/nats.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: envs.rateLimitTtlMs,
        limit: envs.rateLimitMaxRequests
      }
    ]),
    NatsModule
  ],
  controllers: [HelloController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
