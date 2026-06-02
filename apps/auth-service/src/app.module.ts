import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { HelloController } from "./hello.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { NatsModule } from "./transports/nats.module";

@Module({
  // PrismaModule es @Global, así que con importarlo aquí queda disponible en AuthModule.
  imports: [NatsModule, PrismaModule, AuthModule],
  controllers: [HelloController]
})
export class AppModule {}
