import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/**
 * AuthModule agrupa todo lo relacionado con autenticación.
 *
 * JwtModule.register({}) se registra SIN secret global a propósito: cada llamada a
 * sign/verify dentro de AuthService pasa su propio secret (JWT_SECRET para el access
 * token, JWT_REFRESH_SECRET para el refresh). Así mantenemos los dos secretos
 * separados en lugar de depender de uno por defecto.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}
