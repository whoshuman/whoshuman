import { Module } from "@nestjs/common";
import { MessagingService } from "../common";
import { NatsModule } from "../transports/nats.module";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

/**
 * AuthModule agrupa las rutas HTTP de autenticación del gateway.
 *
 * Importa NatsModule (cliente NATS) y registra como providers MessagingService
 * y JwtAuthGuard, ambos inyectables en el controller.
 */
@Module({
  imports: [NatsModule],
  controllers: [AuthController],
  providers: [MessagingService, JwtAuthGuard]
})
export class AuthModule {}
